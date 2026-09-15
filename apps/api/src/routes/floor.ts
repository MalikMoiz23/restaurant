import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { q, one, tx, audit, broadcast, estimateMinutes } from '../core.js';

const tableStatus = z.enum([
  'free', 'occupied', 'ordering', 'eating', 'awaiting_bill', 'needs_cleaning',
]);

export default async function floorRoutes(app: FastifyInstance) {
  /**
   * Live floor plan for the manager dashboard: every table with its
   * status, open session, running total and any unanswered waiter call.
   */
  app.get('/api/tables', async () => {
    const rows = await q(
      `select t.id, t.number, t.seats, t.status, t.grid_x, t.grid_y, t.updated_at,
              z.code as zone_code, z.name_pt as zone_name_pt, z.name_en as zone_name_en,
              s.id as session_id, s.opened_at, s.guest_count, s.locale,
              coalesce(st.gross_cents, 0) as gross_cents,
              coalesce(st.line_count, 0)  as line_count,
              (select count(*)::int from customer_order o
                 where o.session_id = s.id and o.status in ('received','preparing','ready')
              ) as active_orders,
              (select json_build_object('id', w.id, 'reason', w.reason, 'created_at', w.created_at)
                 from waiter_call w
                where w.table_id = t.id and w.acknowledged_at is null
                order by w.created_at limit 1
              ) as open_call
         from restaurant_table t
         join zone z on z.id = t.zone_id
         left join table_session s on s.table_id = t.id and s.status <> 'closed'
         left join session_totals st on st.session_id = s.id
        order by z.sort_order, t.number`,
    );
    return rows;
  });

  app.get('/api/zones', async () =>
    q(`select id, code, name_pt, name_en, sort_order from zone order by sort_order`));

  /** Manually override a table's status from the dashboard. */
  app.patch('/api/tables/:id/status', async (req, reply) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const { status } = z.object({ status: tableStatus }).parse(req.body);

    const row = await one(
      `update restaurant_table set status = $2, updated_at = now()
        where id = $1 returning id, number, status`,
      [id, status],
    );
    if (!row) return reply.code(404).send({ error: 'table_not_found' });

    await audit('table', String(id), 'status_changed', { status }, req.staff?.id ?? null, req.ip);
    broadcast({ type: 'table.status', tableId: row.id, tableNumber: row.number, status });
    return row;
  });

  // -------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------

  /** Open (or re-attach to) a session for a table. Idempotent by design:
   *  a tablet that reloads must land back on the same open session. */
  app.post('/api/sessions', async (req, reply) => {
    const body = z.object({
      tableNumber: z.number().int().positive(),
      guestCount: z.number().int().min(1).max(20).default(2),
      locale: z.enum(['pt', 'en', 'es', 'fr']).default('pt'),
    }).parse(req.body);

    const table = await one(
      `select id, number from restaurant_table where number = $1`,
      [body.tableNumber],
    );
    if (!table) return reply.code(404).send({ error: 'table_not_found' });

    const existing = await one(
      `select id from table_session where table_id = $1 and status <> 'closed'`,
      [table.id],
    );
    if (existing) {
      return { sessionId: existing.id, tableNumber: table.number, reattached: true };
    }

    const session = await tx(async (c) => {
      const { rows } = await c.query(
        `insert into table_session (table_id, guest_count, locale, opened_by)
         values ($1, $2, $3, $4) returning id`,
        [table.id, body.guestCount, body.locale, req.staff?.id ?? null],
      );
      await c.query(
        `update restaurant_table set status = 'ordering', updated_at = now() where id = $1`,
        [table.id],
      );
      // Every session gets its bill row up front, so the counter can
      // always look a table up even before the first order lands.
      await c.query(`insert into bill (session_id) values ($1)`, [rows[0].id]);
      return rows[0];
    });

    await audit('session', session.id, 'opened',
      { table: table.number, guests: body.guestCount }, req.staff?.id ?? null, req.ip);
    broadcast({ type: 'session.opened', sessionId: session.id, tableNumber: table.number });
    broadcast({ type: 'table.status', tableId: table.id, tableNumber: table.number, status: 'ordering' });

    return { sessionId: session.id, tableNumber: table.number, reattached: false };
  });

  /** Everything a tablet needs to render its own table: orders + bill. */
  app.get('/api/sessions/by-table/:number', async (req, reply) => {
    const { number } = z.object({ number: z.coerce.number().int() }).parse(req.params);

    const session = await one(
      `select s.id, s.table_id, s.guest_count, s.locale, s.status, s.opened_at,
              t.number as table_number, t.seats, t.status as table_status
         from table_session s
         join restaurant_table t on t.id = s.table_id
        where t.number = $1 and s.status <> 'closed'`,
      [number],
    );
    if (!session) return reply.code(404).send({ error: 'no_open_session' });

    return withSessionDetail(session);
  });

  app.get('/api/sessions/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const session = await one(
      `select s.id, s.table_id, s.guest_count, s.locale, s.status, s.opened_at,
              t.number as table_number, t.seats, t.status as table_status
         from table_session s
         join restaurant_table t on t.id = s.table_id
        where s.id = $1`,
      [id],
    );
    if (!session) return reply.code(404).send({ error: 'session_not_found' });
    return withSessionDetail(session);
  });

  // -------------------------------------------------------------------
  // Waiter call button
  // -------------------------------------------------------------------

  app.post('/api/waiter-calls', async (req, reply) => {
    const body = z.object({
      tableNumber: z.number().int().positive(),
      reason: z.enum(['help', 'water', 'bill', 'cleaning', 'cutlery']).default('help'),
    }).parse(req.body);

    const table = await one(`select id, number from restaurant_table where number = $1`,
      [body.tableNumber]);
    if (!table) return reply.code(404).send({ error: 'table_not_found' });

    const session = await one(
      `select id from table_session where table_id = $1 and status <> 'closed'`, [table.id]);

    // Collapse repeat taps: an unanswered call for the same reason is reused.
    const open = await one(
      `select id from waiter_call
        where table_id = $1 and reason = $2 and acknowledged_at is null`,
      [table.id, body.reason],
    );
    if (open) return { id: open.id, deduplicated: true };

    const call = await one(
      `insert into waiter_call (table_id, session_id, reason)
       values ($1, $2, $3) returning id, reason, created_at`,
      [table.id, session?.id ?? null, body.reason],
    );

    // Asking for the bill also moves the table on the manager's board.
    if (body.reason === 'bill') {
      await q(`update restaurant_table set status = 'awaiting_bill', updated_at = now() where id = $1`,
        [table.id]);
      await q(`update table_session set status = 'awaiting_bill' where table_id = $1 and status = 'open'`,
        [table.id]);
      broadcast({ type: 'table.status', tableId: table.id, tableNumber: table.number, status: 'awaiting_bill' });
    }

    await audit('waiter_call', call!.id, 'raised', { reason: body.reason, table: table.number });
    broadcast({ type: 'waiter.call', callId: call!.id, tableNumber: table.number, reason: body.reason });
    return { ...call, deduplicated: false };
  });

  app.get('/api/waiter-calls', async () =>
    q(`select w.id, w.reason, w.created_at, t.number as table_number, z.name_pt as zone
         from waiter_call w
         join restaurant_table t on t.id = w.table_id
         join zone z on z.id = t.zone_id
        where w.acknowledged_at is null
        order by w.created_at`));

  app.patch('/api/waiter-calls/:id/ack', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const row = await one(
      `update waiter_call set acknowledged_at = now(), acknowledged_by = $2
        where id = $1 and acknowledged_at is null
        returning id, table_id, (select number from restaurant_table where id = table_id) as table_number`,
      [id, req.staff?.id ?? null],
    );
    if (!row) return reply.code(404).send({ error: 'call_not_found_or_answered' });

    await audit('waiter_call', id, 'acknowledged', {}, req.staff?.id ?? null, req.ip);
    broadcast({ type: 'waiter.ack', callId: id, tableNumber: row.table_number });
    return row;
  });
}

/** Loads the orders and running bill that hang off one session. */
async function withSessionDetail(session: any) {
  const orders = await q(
    `select o.id, o.seq, o.status, o.note, o.placed_at, o.preparing_at, o.ready_at, o.served_at,
            coalesce(json_agg(json_build_object(
              'id', oi.id, 'menuItemId', oi.menu_item_id, 'name', oi.name_snapshot,
              'unitPriceCents', oi.unit_price_cents, 'vatRate', oi.vat_rate,
              'qty', oi.qty, 'note', oi.note, 'seatNo', oi.seat_no, 'station', oi.station,
              'glyph', (select glyph from menu_item where id = oi.menu_item_id),
              'prepMinutes', (select prep_minutes from menu_item where id = oi.menu_item_id)
            ) order by oi.name_snapshot) filter (where oi.id is not null), '[]') as items
       from customer_order o
       left join order_item oi on oi.order_id = o.id
      where o.session_id = $1
      group by o.id
      order by o.seq`,
    [session.id],
  );

  // Each order carries its own estimate so the guest can be told when
  // that specific order should land, not just the table as a whole.
  for (const order of orders) {
    order.estimated_minutes = estimateMinutes(order.items);
    order.ready_estimate_at = new Date(
      new Date(order.placed_at).getTime() + order.estimated_minutes * 60_000,
    ).toISOString();
  }

  const totals = await one(
    `select net_cents, vat_13_cents, vat_23_cents, gross_cents, line_count
       from session_totals where session_id = $1`,
    [session.id],
  );

  const bill = await one(
    `select id, status, split_mode, nif, payment_method, invoice_no, atcud,
            qr_payload, finalized_at, total_cents
       from bill where session_id = $1`,
    [session.id],
  );

  const openCall = await one(
    `select id, reason, created_at from waiter_call
      where table_id = $1 and acknowledged_at is null order by created_at limit 1`,
    [session.table_id],
  );

  return { session, orders, totals, bill, openCall };
}
