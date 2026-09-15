import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { q, one, tx, audit, broadcast, estimateMinutes } from '../core.js';

const orderStatus = z.enum(['received', 'preparing', 'ready', 'served', 'cancelled']);

export default async function orderRoutes(app: FastifyInstance) {
  /**
   * Place an order against an open session. Called for the first order
   * and for every mid-meal reorder alike - the sequence number is what
   * distinguishes "Pedido 1" from "Pedido 3" on the kitchen screen.
   */
  app.post('/api/orders', async (req, reply) => {
    const body = z.object({
      sessionId: z.string().uuid(),
      note: z.string().max(280).default(''),
      items: z.array(z.object({
        menuItemId: z.number().int().positive(),
        qty: z.number().int().min(1).max(50),
        note: z.string().max(140).default(''),
        seatNo: z.number().int().min(1).max(20).nullable().default(null),
      })).min(1).max(60),
    }).parse(req.body);

    const session = await one(
      `select s.id, s.status, t.id as table_id, t.number as table_number
         from table_session s
         join restaurant_table t on t.id = s.table_id
        where s.id = $1`,
      [body.sessionId],
    );
    if (!session) return reply.code(404).send({ error: 'session_not_found' });
    if (session.status === 'closed') return reply.code(409).send({ error: 'session_closed' });

    // Price and availability are read server-side. A tablet never gets
    // to tell the kitchen what something costs.
    const ids = [...new Set(body.items.map((i) => i.menuItemId))];
    const menu = await q(
      `select m.id, m.price_cents, m.vat_rate, m.available, m.kitchen_station,
              m.prep_minutes, coalesce(i.name, m.sku) as name
         from menu_item m
         left join menu_item_i18n i on i.item_id = m.id and i.locale = 'pt'
        where m.id = any($1::int[])`,
      [ids],
    );
    const byId = new Map(menu.map((m) => [m.id, m]));

    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) return reply.code(400).send({ error: 'unknown_items', items: missing });

    const soldOut = ids.filter((id) => !byId.get(id)!.available);
    if (soldOut.length) return reply.code(409).send({ error: 'items_unavailable', items: soldOut });

    const created = await tx(async (c) => {
      const { rows: seqRows } = await c.query(
        `select coalesce(max(seq), 0) + 1 as next from customer_order where session_id = $1`,
        [body.sessionId],
      );
      const seq = seqRows[0].next as number;

      const { rows: orderRows } = await c.query(
        `insert into customer_order (session_id, seq, note)
         values ($1, $2, $3) returning id, seq, status, placed_at`,
        [body.sessionId, seq, body.note],
      );
      const order = orderRows[0];

      for (const line of body.items) {
        const m = byId.get(line.menuItemId)!;
        await c.query(
          `insert into order_item
             (order_id, menu_item_id, name_snapshot, unit_price_cents, vat_rate, qty, note, seat_no, station)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [order.id, m.id, m.name, m.price_cents, m.vat_rate, line.qty, line.note, line.seatNo, m.kitchen_station],
        );
      }

      await c.query(
        `update restaurant_table set status = 'eating', updated_at = now() where id = $1`,
        [session.table_id],
      );
      return order;
    });

    await audit('order', created.id, 'placed',
      { table: session.table_number, seq: created.seq, lines: body.items.length },
      req.staff?.id ?? null, req.ip);

    broadcast({
      type: 'order.created',
      orderId: created.id,
      tableNumber: session.table_number,
      sessionId: body.sessionId,
    });
    broadcast({
      type: 'table.status',
      tableId: session.table_id,
      tableNumber: session.table_number,
      status: 'eating',
    });

    // Quote the wait back immediately, so the confirmation screen can
    // tell the guest when to expect the food rather than just "sent".
    const estimatedMinutes = estimateMinutes(
      body.items.map((line) => ({
        prepMinutes: byId.get(line.menuItemId)!.prep_minutes as number,
        qty: line.qty,
      })),
    );

    return reply.code(201).send({
      id: created.id,
      seq: created.seq,
      status: created.status,
      estimatedMinutes,
      readyEstimateAt: new Date(
        new Date(created.placed_at).getTime() + estimatedMinutes * 60_000,
      ).toISOString(),
    });
  });

  /**
   * The kitchen queue. One row per order, items grouped, oldest first,
   * with the age in seconds so the screen can colour by wait time.
   */
  app.get('/api/kds/orders', async (req) => {
    const { station } = z.object({
      station: z.enum(['all', 'cozinha', 'grelha', 'bar', 'pastelaria']).default('all'),
    }).parse(req.query ?? {});

    const rows = await q(
      `select o.id, o.seq, o.status, o.note, o.placed_at, o.preparing_at, o.ready_at,
              extract(epoch from (now() - o.placed_at))::int as age_seconds,
              t.number as table_number, z.name_pt as zone_name, s.guest_count,
              json_agg(json_build_object(
                'id', oi.id, 'name', oi.name_snapshot, 'qty', oi.qty,
                'note', oi.note, 'station', oi.station, 'seatNo', oi.seat_no,
                'glyph', (select glyph from menu_item where id = oi.menu_item_id),
                'prepMinutes', (select prep_minutes from menu_item where id = oi.menu_item_id)
              ) order by oi.station, oi.name_snapshot) as items
         from customer_order o
         join table_session s on s.id = o.session_id
         join restaurant_table t on t.id = s.table_id
         join zone z on z.id = t.zone_id
         join order_item oi on oi.order_id = o.id
        where o.status in ('received', 'preparing', 'ready')
          and ($1 = 'all' or oi.station = $1)
        group by o.id, t.number, z.name_pt, s.guest_count
        order by o.placed_at`,
      [station],
    );

    // The kitchen sees the same estimate the guest was quoted, so a
    // ticket drifting past it is visible on both screens at once.
    for (const row of rows) {
      row.estimated_minutes = estimateMinutes(row.items);
      row.ready_estimate_at = new Date(
        new Date(row.placed_at).getTime() + row.estimated_minutes * 60_000,
      ).toISOString();
    }
    return rows;
  });

  /** Advance an order through received -> preparing -> ready -> served. */
  app.patch('/api/orders/:id/status', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { status } = z.object({ status: orderStatus }).parse(req.body);

    // Stamp the matching timestamp column so we keep a real timeline
    // rather than only the latest state.
    const stampColumn = {
      preparing: 'preparing_at', ready: 'ready_at', served: 'served_at',
      received: null, cancelled: null,
    }[status];

    const setStamp = stampColumn ? `, ${stampColumn} = coalesce(${stampColumn}, now())` : '';

    const row = await one(
      `update customer_order set status = $2 ${setStamp}
        where id = $1
        returning id, status, seq, session_id,
          (select t.number from table_session s
             join restaurant_table t on t.id = s.table_id
            where s.id = session_id) as table_number`,
      [id, status],
    );
    if (!row) return reply.code(404).send({ error: 'order_not_found' });

    await audit('order', id, `status_${status}`, { status }, req.staff?.id ?? null, req.ip);
    broadcast({ type: 'order.status', orderId: id, status, tableNumber: row.table_number });
    return row;
  });

  /** Void a single line before the kitchen starts on it. */
  app.delete('/api/order-items/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const line = await one(
      `select oi.id, oi.name_snapshot, oi.order_id, o.status
         from order_item oi join customer_order o on o.id = oi.order_id
        where oi.id = $1`,
      [id],
    );
    if (!line) return reply.code(404).send({ error: 'line_not_found' });
    if (line.status !== 'received') {
      return reply.code(409).send({ error: 'already_in_preparation' });
    }

    await q(`delete from order_item where id = $1`, [id]);
    await audit('order_item', id, 'voided', { name: line.name_snapshot },
      req.staff?.id ?? null, req.ip);
    return { deleted: true };
  });
}
