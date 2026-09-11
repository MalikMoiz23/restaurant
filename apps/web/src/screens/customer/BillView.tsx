import { motion } from 'framer-motion';
import type { SessionDetail } from '../../lib/api';
import { euro, clock } from '../../lib/format';
import { Icon } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { Button, EmptyState, SPRING } from '../../ui';

/**
 * The guest's own view of the running bill, with IVA broken out by rate
 * the way a Portuguese bill is expected to read. Payment itself happens
 * at the counter, so this screen ends by saying so.
 */
export function BillView({
  detail, tableNumber, onBrowse, onRequestBill,
}: {
  detail: SessionDetail;
  tableNumber: number;
  onBrowse: () => void;
  onRequestBill: () => void;
}) {
  const { t, locale } = useI18n();
  const totals = detail.totals;

  if (!totals || totals.line_count === 0) {
    return (
      <EmptyState
        icon="receipt"
        title={t('bill.noItems')}
        body={t('cart.emptyHint')}
        action={<Button variant="primary" onClick={onBrowse}>{t('menu.title')}</Button>}
      />
    );
  }

  const lines = detail.orders
    .filter((o) => o.status !== 'cancelled')
    .flatMap((order) => order.items.map((item) => ({ ...item, seq: order.seq })));

  return (
    <div className="pt-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="overflow-hidden rounded-plate bg-white shadow-plate hairline"
      >
        <div className="relative overflow-hidden bg-azul-600 px-5 py-5 text-white">
          <div className="azulejo-soft absolute inset-0 opacity-[0.12]" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-azul-200">{t('bill.running')}</p>
              <p className="display mt-0.5 text-2xl font-semibold">
                {t('common.tableN', { n: tableNumber })}
              </p>
              <p className="mt-1 text-xs text-azul-200">
                {t('counter.since', { t: clock(detail.session.opened_at, locale) })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-azul-200">{t('common.toPay')}</p>
              <p className="text-3xl font-semibold tnum">{euro(totals.gross_cents, locale)}</p>
            </div>
          </div>
        </div>

        <ul className="divide-y divide-cal-100 px-5">
          {lines.map((line) => (
            <li key={line.id} className="flex items-start gap-3 py-3">
              <span className="w-7 shrink-0 text-sm font-semibold text-cal-500 tnum">
                {line.qty}×
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-cal-800">{line.name}</p>
                <p className="text-xs text-cal-400">
                  {t('bill.orderN', { n: line.seq })} ·{' '}
                  {t('common.ivaAt', { rate: Number(line.vatRate) })}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-cal-900 tnum">
                {euro(line.unitPriceCents * line.qty, locale)}
              </span>
            </li>
          ))}
        </ul>

        {/* Tax summary. Portuguese catering carries two rates at once -
            13% on food, 23% on alcohol and soft drinks - so both lines
            are shown whenever they are non-zero. */}
        <div className="border-t border-cal-200 bg-cal-50 px-5 py-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between text-cal-600">
              <dt>{t('common.subtotal')}</dt>
              <dd className="tnum">{euro(totals.net_cents, locale)}</dd>
            </div>
            {totals.vat_13_cents > 0 && (
              <div className="flex justify-between text-cal-600">
                <dt>{t('common.ivaAt', { rate: 13 })}</dt>
                <dd className="tnum">{euro(totals.vat_13_cents, locale)}</dd>
              </div>
            )}
            {totals.vat_23_cents > 0 && (
              <div className="flex justify-between text-cal-600">
                <dt>{t('common.ivaAt', { rate: 23 })}</dt>
                <dd className="tnum">{euro(totals.vat_23_cents, locale)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-cal-200 pt-2.5 text-base font-semibold text-cal-900">
              <dt>{t('common.toPay')}</dt>
              <dd className="tnum">{euro(totals.gross_cents, locale)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-cal-400">{t('bill.ivaIncluded')}</p>
        </div>
      </motion.div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-azul-50 p-4 text-sm text-azul-800">
        <Icon name="info" className="mt-0.5 size-5 shrink-0" />
        {t('bill.payAtCounter')}
      </div>

      <Button
        variant="primary"
        size="xl"
        block
        className="mt-4"
        icon="bell"
        onClick={onRequestBill}
      >
        {t('bill.askForBill')}
      </Button>
    </div>
  );
}
