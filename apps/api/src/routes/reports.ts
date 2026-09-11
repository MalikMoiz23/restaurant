import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { q, one, tx, audit, broadcast } from '../core.js';

export default async function reportRoutes(app: FastifyInstance) {
  /**
   * Sales per day over a range, for the owner's calendar. Historical
   * days come from the close-out table; today is computed live from
   * finalized bills so the figure moves during service.
   */
  app.get('/api/reports/sales', async (req) => {
    const { from, to } = z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(req.query);

    const days = await q(
      `with closed as (
         select business_date, gross_cents, vat_cents, net_cents,
                bills_count, covers_count, by_payment, true as is_closed
           from daily_closeout
          where business_date between $1::date and $2::date
       ),
       -- Days not yet closed out are totalled live from finalized bills,
       -- so the calendar shows today's takings as service goes on.
       live as (
         select b.business_date,
                sum(b.total_cents)::int                    as gross_cents,
                sum(b.vat_13_cents + b.vat_23_cents)::int  as vat_cents,
                sum(b.subtotal_cents)::int                 as net_cents,
                count(*)::int                              as bills_count,
                coalesce(sum(s.guest_count), 0)::int       as covers_count,
                (select coalesce(jsonb_object_agg(method, total), '{}'::jsonb)
                   from (select coalesce(b2.payment_method, 'card') as method,
                                sum(b2.total_cents)::int as total
                           from bill b2
                          where b2.status = 'finalized'
                            and b2.business_date = b.business_date
                          group by 1) pm)                  as by_payment,
                false as is_closed
           from bill b
           join table_session s on s.id = b.session_id
          where b.status = 'finalized'
            and b.business_date between $1::date and $2::date
            and not exists (
              select 1 from daily_closeout dc where dc.business_date = b.business_date
            )
          group by b.business_date
       )
       select * from closed
       union all
       select * from live
       order by business_date`,
      [from, to],
    );

    const totals = days.reduce(
      (acc, d) => ({
        gross_cents: acc.gross_cents + Number(d.gross_cents ?? 0),
        vat_cents: acc.vat_cents + Number(d.vat_cents ?? 0),
        net_cents: acc.net_cents + Number(d.net_cents ?? 0),
        bills_count: acc.bills_count + Number(d.bills_count ?? 0),
        covers_count: acc.covers_count + Number(d.covers_count ?? 0),
      }),
      { gross_cents: 0, vat_cents: 0, net_cents: 0, bills_count: 0, covers_count: 0 },
    );

    const tradingDays = days.filter((d) => Number(d.gross_cents ?? 0) > 0).length;

    return {
      from, to, days, totals,
      averages: {
        per_day_cents: tradingDays ? Math.round(totals.gross_cents / tradingDays) : 0,
        per_cover_cents: totals.covers_count
          ? Math.round(totals.gross_cents / totals.covers_count) : 0,
        per_bill_cents: totals.bills_count
          ? Math.round(totals.gross_cents / totals.bills_count) : 0,
      },
      trading_days: tradingDays,
    };
  });

  /** What today looks like so far, for the close-out screen. */
  app.get('/api/reports/today', async () => {
    const summary = await one(
      `select coalesce(sum(total_cents), 0)::int                   as gross_cents,
              coalesce(sum(vat_13_cents + vat_23_cents), 0)::int   as vat_cents,
              coalesce(sum(subtotal_cents), 0)::int                as net_cents,
              coalesce(sum(vat_13_cents), 0)::int                  as vat_13_cents,
              coalesce(sum(vat_23_cents), 0)::int                  as vat_23_cents,
              count(*)::int                                        as bills_count
         from bill where status = 'finalized' and business_date = current_date`,
    );

    const byPayment = await q(
      `select coalesce(payment_method, 'card') as method,
              sum(total_cents)::int as total_cents, count(*)::int as count
         from bill
        where status = 'finalized' and business_date = current_date
        group by 1 order by 2 desc`,
    );

    const topItems = await q(
      `select oi.name_snapshot as name, sum(oi.qty)::int as qty,
              sum(oi.qty * oi.unit_price_cents)::int as revenue_cents,
              (select glyph from menu_item where id = oi.menu_item_id) as glyph
         from order_item oi
         join customer_order o on o.id = oi.order_id
         join bill b on b.session_id = o.session_id
        where b.status = 'finalized' and b.business_date = current_date
        group by oi.name_snapshot, oi.menu_item_id
        order by qty desc limit 8`,
    );

    const openTables = await one(
      `select count(*)::int as count,
              coalesce(sum(st.gross_cents), 0)::int as gross_cents
         from table_session s
         join session_totals st on st.session_id = s.id
        where s.status <> 'closed'`,
    );

    const closeout = await one(
      `select business_date, closed_at from daily_closeout where business_date = current_date`,
    );

    return { summary, byPayment, topItems, openTables, closeout };
  });

  /**
   * End-of-day close-out. Totals the day's finalized bills and registers
   * them against the date, which is what the calendar then reads.
   * Refuses while tables are still open - the day is not over yet.
   */
  app.post('/api/reports/closeout', async (req, reply) => {
    const { force } = z.object({ force: z.boolean().default(false) })
      .parse(req.body ?? {});

    const existing = await one(
      `select business_date from daily_closeout where business_date = current_date`);
    if (existing) return reply.code(409).send({ error: 'already_closed_today' });

    const open = await q(`select id from table_session where status <> 'closed'`);
    if (open.length && !force) {
      return reply.code(409).send({ error: 'open_sessions', count: open.length });
    }

    const row = await tx(async (c) => {
      const { rows } = await c.query(
        `insert into daily_closeout
           (business_date, gross_cents, vat_cents, net_cents, bills_count, covers_count, by_payment, closed_by)
         select current_date,
                coalesce(sum(b.total_cents), 0)::int,
                coalesce(sum(b.vat_13_cents + b.vat_23_cents), 0)::int,
                coalesce(sum(b.subtotal_cents), 0)::int,
                count(*)::int,
                coalesce(sum(s.guest_count), 0)::int,
                coalesce(
                  (select jsonb_object_agg(method, total)
                     from (select coalesce(payment_method, 'card') as method,
                                  sum(total_cents)::int as total
                             from bill
                            where status = 'finalized' and business_date = current_date
                            group by 1) x),
                  '{}'::jsonb),
                $1
           from bill b
           join table_session s on s.id = b.session_id
          where b.status = 'finalized' and b.business_date = current_date
         returning *`,
        [req.staff?.id ?? null],
      );
      return rows[0];
    });

    await audit('closeout', String(row.business_date), 'day_closed',
      { gross: row.gross_cents, bills: row.bills_count }, req.staff?.id ?? null, req.ip);
    broadcast({
      type: 'closeout.done',
      businessDate: String(row.business_date),
      grossCents: row.gross_cents,
    });

    return row;
  });

  /** Audit trail viewer for the manager. */
  app.get('/api/reports/audit', async (req) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(200).default(60) })
      .parse(req.query ?? {});
    return q(
      `select a.id, a.at, a.entity, a.entity_id, a.action, a.detail, a.ip, s.name as staff_name
         from audit_log a
         left join staff s on s.id = a.staff_id
        order by a.at desc limit $1`,
      [limit],
    );
  });
}
