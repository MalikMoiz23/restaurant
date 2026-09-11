import { useState } from 'react';
import { motion } from 'framer-motion';
import { api, type TodayReport } from '../../lib/api';
import { useQuery } from '../../lib/live';
import { euro, clock, dateLong } from '../../lib/format';
import { DishArt } from '../../lib/DishArt';
import { Icon } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { Button, Modal, Skeleton, SPRING, cn, useToast } from '../../ui';

/**
 * End-of-day close-out. Totals the day's finalized bills and writes them
 * against the date, which is what the sales calendar then reads back.
 */
export function CloseoutView() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const today = useQuery<TodayReport>(() => api.today(), []);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function close(force: boolean) {
    setBusy(true);
    try {
      const result = await api.closeout(force);
      toast({
        tone: 'success',
        title: t('close.closed'),
        body: t('close.closedBody', {
          v: euro(result.gross_cents, locale),
          d: dateLong(result.business_date, locale),
        }),
        icon: 'check',
      });
      setConfirmOpen(false);
      today.reload();
    } catch (err: any) {
      if (err?.code === 'open_sessions') {
        toast({
          tone: 'warn',
          title: t('close.openWarning', { n: err.detail?.count ?? '?' }),
          body: t('close.openWarningBody'),
          icon: 'alert',
        });
      } else if (err?.code === 'already_closed_today') {
        toast({ tone: 'warn', title: t('close.alreadyClosed', { t: '' }), icon: 'info' });
        today.reload();
      } else {
        toast({ tone: 'error', title: t('common.somethingWrong'), icon: 'alert' });
      }
    } finally {
      setBusy(false);
    }
  }

  if (today.loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }

  const data = today.data;
  const closed = !!data?.closeout;
  const openTables = data?.openTables.count ?? 0;

  return (
    <div>
      <div className="mb-5">
        <h1 className="display text-2xl font-semibold text-cal-900">{t('close.title')}</h1>
        <p className="text-sm text-cal-500">{t('close.subtitle')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile
              label={t('close.grossToday')}
              value={euro(data?.summary.gross_cents ?? 0, locale)}
              icon="coins"
              primary
            />
            <Tile
              label={t('close.ivaToday')}
              value={euro(data?.summary.vat_cents ?? 0, locale)}
              icon="receipt"
              hint={`13%: ${euro(data?.summary.vat_13_cents ?? 0, locale)} · 23%: ${euro(data?.summary.vat_23_cents ?? 0, locale)}`}
            />
            <Tile
              label={t('close.billsToday')}
              value={String(data?.summary.bills_count ?? 0)}
              icon="printer"
            />
          </div>

          {(data?.byPayment.length ?? 0) > 0 && (
            <div className="rounded-plate bg-white p-5 shadow-plate hairline">
              <h2 className="mb-3 text-sm font-semibold text-cal-800">{t('sales.byPayment')}</h2>
              <div className="space-y-2.5">
                {data!.byPayment.map((row) => {
                  const share = row.total_cents / Math.max(1, data!.summary.gross_cents);
                  return (
                    <div key={row.method}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-cal-700">
                          {t(`billing.method.${row.method}` as never)}
                          <span className="ml-1.5 text-xs text-cal-400 tnum">×{row.count}</span>
                        </span>
                        <span className="font-medium text-cal-900 tnum">
                          {euro(row.total_cents, locale)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-cal-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${share * 100}%` }}
                          transition={{ ...SPRING, damping: 26 }}
                          className="h-full rounded-full bg-azul-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(data?.topItems.length ?? 0) > 0 && (
            <div className="rounded-plate bg-white p-5 shadow-plate hairline">
              <h2 className="mb-3 text-sm font-semibold text-cal-800">{t('sales.topItems')}</h2>
              <ul className="space-y-2">
                {data!.topItems.map((item, index) => (
                  <motion.li
                    key={item.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING, delay: index * 0.04 }}
                    className="flex items-center gap-3"
                  >
                    <span className="w-5 text-sm font-semibold text-cal-400 tnum">
                      {index + 1}
                    </span>
                    <div className="size-9 shrink-0 overflow-hidden rounded-lg">
                      <DishArt glyph={item.glyph} seed={item.name} className="size-full object-cover" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm text-cal-800">
                      {item.name}
                    </span>
                    <span className="shrink-0 rounded-lg bg-cal-100 px-2 py-0.5 text-xs font-semibold text-cal-600 tnum">
                      {item.qty}×
                    </span>
                    <span className="w-20 shrink-0 text-right text-sm font-medium text-cal-900 tnum">
                      {euro(item.revenue_cents, locale)}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-plate bg-white p-5 shadow-plate hairline lg:sticky lg:top-24">
          {closed ? (
            <div className="text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-oliva-300/25 text-oliva-600">
                <Icon name="check" className="size-7" strokeWidth={2.2} />
              </div>
              <p className="mt-3 font-semibold text-cal-900">{t('close.closed')}</p>
              <p className="mt-1 text-sm text-cal-500">
                {t('close.alreadyClosed', { t: clock(data!.closeout!.closed_at, locale) })}
              </p>
            </div>
          ) : (
            <>
              {openTables > 0 && (
                <div className="mb-4 rounded-2xl bg-amber-50 p-3.5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <Icon name="alert" className="size-4.5 shrink-0" />
                    {t('close.openWarning', { n: openTables })}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">{t('close.openWarningBody')}</p>
                  <p className="mt-2 text-xs font-medium text-amber-800 tnum">
                    {euro(data?.openTables.gross_cents ?? 0, locale)}
                  </p>
                </div>
              )}

              <Button
                variant="primary"
                size="xl"
                block
                icon="coins"
                onClick={() => setConfirmOpen(true)}
              >
                {t('close.doClose')}
              </Button>
              <p className="mt-3 text-center text-xs text-cal-400">{t('close.subtitle')}</p>
            </>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('close.doClose')}
        footer={
          <div className="flex gap-2">
            <Button variant="quiet" size="lg" className="flex-1" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              loading={busy}
              onClick={() => close(openTables > 0)}
            >
              {openTables > 0 ? t('close.forceClose') : t('common.confirm')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-cal-600">{t('close.subtitle')}</p>
        <dl className="mt-4 space-y-2 rounded-2xl bg-cal-100 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-cal-600">{t('close.grossToday')}</dt>
            <dd className="font-semibold text-cal-900 tnum">
              {euro(data?.summary.gross_cents ?? 0, locale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-cal-600">{t('close.billsToday')}</dt>
            <dd className="font-semibold text-cal-900 tnum">
              {data?.summary.bills_count ?? 0}
            </dd>
          </div>
        </dl>
        {openTables > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            {t('close.openWarningBody')}
          </p>
        )}
      </Modal>
    </div>
  );
}

function Tile({
  label, value, icon, hint, primary,
}: {
  label: string;
  value: string;
  icon: 'coins' | 'receipt' | 'printer';
  hint?: string;
  primary?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-plate p-4 shadow-plate',
        primary ? 'bg-azul-600 text-white' : 'bg-white hairline',
      )}
    >
      <div className={cn('flex items-center gap-2', primary ? 'text-azul-200' : 'text-cal-500')}>
        <Icon name={icon} className="size-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={cn('mt-1.5 text-2xl font-semibold tnum', primary ? 'text-white' : 'text-cal-900')}>
        {value}
      </p>
      {hint && (
        <p className={cn('mt-0.5 text-[11px]', primary ? 'text-azul-200' : 'text-cal-400')}>
          {hint}
        </p>
      )}
    </div>
  );
}
