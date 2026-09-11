import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { q, one, tx, audit, broadcast, billTotals, splitEvenly } from '../core.js';
import { issueFiscalDocument } from '../fiscal.js';

const paymentMethod = z.enum(['cash', 'mbway', 'multibanco', 'card']);

export default async function billingRoutes(app: FastifyInstance) {
  /**
   * Counter lookup by table number - the cashier's primary action.
   * Returns the itemised running bill with IVA broken out per rate.
   */
  app.get('/api/bills/by-table/:number', async (req, reply) => {
    const { number } = z.object({ number: z.coerce.number().int() }).parse(req.params);

    const session = await one(
      `select s.id as session_id, s.guest_count, s.opened_at, s.status as session_status,
              t.id as table_id, t.number as table_number, z.name_pt as zone_name
         from table_session s
         join restaurant_table t on t.id = s.table_id
         join zone z on z.id = t.zone_id
        where t.number = $1 and s.status <> 'closed'`,
      [number],
    );
    if (!session) return reply.code(404).send({ error: 'no_open_session' });

    return buildBill(session);
  });

  app.get('/api/bills/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const session = await one(
      `select s.id as session_id, s.guest_count, s.opened_at, s.status as session_status,
              t.id as table_id, t.number as table_number, z.name_pt as zone_name
         from bill b
         join table_session s on s.id = b.session_id
         join restaurant_table t on t.id = s.table_id
         join zone z on z.id = t.zone_id
        where b.id = $1`,
      [id],
    );
    if (!session) return reply.code(404).send({ error: 'bill_not_found' });
    return buildBill(session);
  });

  /**
   * Define how a bill is divided. Three shapes are supported:
   *   even     - N equal shares, remainder cents spread deterministically
   *   by_person - group the lines by the seat each was ordered for
   *   by_item  - the cashier assigns specific lines to each share
   */
  app.post('/api/bills/:id/split', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      mode: z.enum(['none', 'even', 'by_person', 'by_item']),
      ways: z.number().int().min(2).max(20).optional(),
      groups: z.array(z.object({
        label: z.string().min(1).max(40),
        itemIds: z.array(z.string().uuid()).min(1),
      })).optional(),
    }).parse(req.body);

    const bill = await one(
      `select b.id, b.session_id, b.status, t.number as table_number
         from bill b
         join table_session s on s.id = b.session_id
         join restaurant_table t on t.id = s.table_id
        where b.id = $1`,
      [id],
    );
    if (!bill) return reply.code(404).send({ error: 'bill_not_found' });
    if (bill.status === 'finalized') return reply.code(409).send({ error: 'already_finalized' });

    const lines = await sessionLines(bill.session_id);
    const grandTotal = lines.reduce((sum, l) => sum + l.unit_price_cents * l.qty, 0);

    const splits = await tx(async (c) => {
      await c.query(`delete from bill_split where bill_id = $1`, [id]);
      await c.query(`update bill set split_mode = $2 where id = $1`, [id, body.mode]);
      if (body.mode === 'none') return [];

      const made: any[] = [];

      if (body.mode === 'even') {
        const ways = body.ways ?? 2;
        const shares = splitEvenly(grandTotal, ways);
        for (let i = 0; i < ways; i++) {
          const { rows } = await c.query(
            `insert into bill_split (bill_id, label, total_cents)
             values ($1, $2, $3) returning id, label, total_cents`,
            [id, `Pessoa ${i + 1}`, shares[i]],
          );
          made.push({ ...rows[0], items: [] });
        }
        return made;
      }

      // by_person and by_item both reduce to "a set of lines per share".
      const groups = body.mode === 'by_person'
        ? groupBySeat(lines)
        : (body.groups ?? []).map((g) => ({
            label: g.label,
            items: lines.filter((l) => g.itemIds.includes(l.id)),
          }));

      for (const group of groups) {
        const total = group.items.reduce((s, l) => s + l.unit_price_cents * l.qty, 0);
        const { rows } = await c.query(
          `insert into bill_split (bill_id, label, total_cents)
           values ($1, $2, $3) returning id, label, total_cents`,
          [id, group.label, total],
        );
        for (const line of group.items) {
          await c.query(
            `insert into bill_split_item (split_id, order_item_id, qty) values ($1, $2, $3)`,
            [rows[0].id, line.id, line.qty],
          );
        }
        made.push({ ...rows[0], items: group.items });
      }
      return made;
    });

    await audit('bill', id, 'split_defined',
      { mode: body.mode, shares: splits.length }, req.staff?.id ?? null, req.ip);
    return { mode: body.mode, splits };
  });

  app.patch('/api/bill-splits/:id/pay', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { method } = z.object({ method: paymentMethod }).parse(req.body);
    const row = await one(
      `update bill_split set payment_method = $2, paid_at = now()
        where id = $1 returning id, label, total_cents, payment_method, paid_at`,
      [id, method],
    );
    if (!row) return reply.code(404).send({ error: 'split_not_found' });
    await audit('bill_split', id, 'paid', { method }, req.staff?.id ?? null, req.ip);
    return row;
  });

  /**
   * Close the bill. This is the one point where a fiscal document is
   * required, so it is delegated to a certified AT provider (see the
   * project plan, section 4) - we only persist the reference it returns.
   */
  app.post('/api/bills/:id/finalize', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      paymentMethod,
      // Omitted NIF is the normal case: a simplified invoice issued to
      // "Consumidor Final", which Portuguese rules allow for cash sales.
      nif: z.string().regex(/^\d{9}$/).nullable().default(null),
      discountCents: z.number().int().min(0).default(0),
    }).parse(req.body);

    const bill = await one(
      `select b.id, b.session_id, b.status, b.split_mode,
              t.id as table_id, t.number as table_number, s.guest_count
         from bill b
         join table_session s on s.id = b.session_id
         join restaurant_table t on t.id = s.table_id
        where b.id = $1`,
      [id],
    );
    if (!bill) return reply.code(404).send({ error: 'bill_not_found' });
    if (bill.status === 'finalized') return reply.code(409).send({ error: 'already_finalized' });

    const lines = await sessionLines(bill.session_id);
    if (!lines.length) return reply.code(409).send({ error: 'nothing_to_bill' });

    const totals = billTotals(
      lines.map((l) => ({ gross_cents: l.unit_price_cents * l.qty, vat_rate: Number(l.vat_rate) })),
    );
    const payable = Math.max(0, totals.total_cents - body.discountCents);

    const fiscal = await issueFiscalDocument({
      tableNumber: bill.table_number,
      nif: body.nif,
      totalCents: payable,
      vatCents: totals.vat_13_cents + totals.vat_23_cents,
      lines: lines.map((l) => ({
        name: l.name_snapshot, qty: l.qty,
        unitPriceCents: l.unit_price_cents, vatRate: Number(l.vat_rate),
      })),
    });

    const finalized = await tx(async (c) => {
      const { rows } = await c.query(
        `update bill set
            subtotal_cents = $2, vat_13_cents = $3, vat_23_cents = $4,
            discount_cents = $5, total_cents = $6,
            status = 'finalized', payment_method = $7, nif = $8,
            invoice_no = $9, atcud = $10, qr_payload = $11,
            finalized_at = now(), finalized_by = $12, business_date = current_date
          where id = $1
          returning *`,
        [
          id, totals.subtotal_cents, totals.vat_13_cents, totals.vat_23_cents,
          body.discountCents, payable, body.paymentMethod, body.nif,
          fiscal.invoiceNo, fiscal.atcud, fiscal.qrPayload, req.staff?.id ?? null,
        ],
      );
      await c.query(
        `update table_session set status = 'closed', closed_at = now() where id = $1`,
        [bill.session_id],
      );
      await c.query(
        `update restaurant_table set status = 'needs_cleaning', updated_at = now() where id = $1`,
        [bill.table_id],
      );
      await c.query(
        `update customer_order set status = 'served', served_at = coalesce(served_at, now())
          where session_id = $1 and status <> 'cancelled'`,
        [bill.session_id],
      );
      await c.query(
        `update waiter_call set acknowledged_at = now()
          where session_id = $1 and acknowledged_at is null`,
        [bill.session_id],
      );
      return rows[0];
    });

    await audit('bill', id, 'finalized', {
      table: bill.table_number, total: payable,
      method: body.paymentMethod, nif: body.nif ?? 'consumidor_final',
      invoice: fiscal.invoiceNo,
    }, req.staff?.id ?? null, req.ip);

    broadcast({ type: 'bill.finalized', billId: id, tableNumber: bill.table_number, totalCents: payable });
    broadcast({ type: 'session.closed', sessionId: bill.session_id, tableNumber: bill.table_number });
    broadcast({
      type: 'table.status', tableId: bill.table_id,
      tableNumber: bill.table_number, status: 'needs_cleaning',
    });

    return {
      bill: finalized,
      receipt: {
        tableNumber: bill.table_number,
        guestCount: bill.guest_count,
        lines,
        totals: { ...totals, discount_cents: body.discountCents, payable_cents: payable },
        paymentMethod: body.paymentMethod,
        nif: body.nif,
        ...fiscal,
      },
    };
  });
}

// ---------------------------------------------------------------------

async function sessionLines(sessionId: string) {
  return q(
    `select oi.id, oi.name_snapshot, oi.unit_price_cents, oi.vat_rate, oi.qty,
            oi.seat_no, oi.note, o.seq as order_seq,
            (select glyph from menu_item where id = oi.menu_item_id) as glyph
       from order_item oi
       join customer_order o on o.id = oi.order_id
      where o.session_id = $1 and o.status <> 'cancelled'
      order by o.seq, oi.name_snapshot`,
    [sessionId],
  );
}

async function buildBill(session: any) {
  const lines = await sessionLines(session.session_id);
  const totals = billTotals(
    lines.map((l) => ({ gross_cents: l.unit_price_cents * l.qty, vat_rate: Number(l.vat_rate) })),
  );

  const bill = await one(
    `select id, status, split_mode, nif, payment_method, discount_cents,
            invoice_no, atcud, qr_payload, finalized_at
       from bill where session_id = $1`,
    [session.session_id],
  );

  const splits = bill
    ? await q(
        `select bs.id, bs.label, bs.total_cents, bs.payment_method, bs.paid_at,
                coalesce(json_agg(bsi.order_item_id) filter (where bsi.order_item_id is not null), '[]') as item_ids
           from bill_split bs
           left join bill_split_item bsi on bsi.split_id = bs.id
          where bs.bill_id = $1
          group by bs.id
          order by bs.label`,
        [bill.id],
      )
    : [];

  return { session, bill, lines, totals, splits };
}

/** Groups lines by the seat they were ordered for; unassigned go to a shared share. */
function groupBySeat(lines: any[]) {
  const bySeat = new Map<number | null, any[]>();
  for (const line of lines) {
    const key = line.seat_no ?? null;
    if (!bySeat.has(key)) bySeat.set(key, []);
    bySeat.get(key)!.push(line);
  }
  return [...bySeat.entries()]
    .sort((a, b) => (a[0] ?? 999) - (b[0] ?? 999))
    .map(([seat, items]) => ({
      label: seat === null ? 'Partilhado' : `Lugar ${seat}`,
      items,
    }));
}
