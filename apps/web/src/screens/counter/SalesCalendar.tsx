import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, type SalesDay, type SalesReport } from '../../lib/api';
import { useQuery } from '../../lib/live';
import {
  euro, euroCompact, dateLong, isoDate, startOfMonth, endOfMonth,
  addDays, mondayIndex, monthLabel, weekdayInitials,
} from '../../lib/format';
import { Icon } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { Segmented, Skeleton, SPRING, cn } from '../../ui';

type Preset = 'month' | 'last3' | 'last7' | 'last30';

/**
 * Calendar-based sales reporting. A month grid where each day carries
 * its own takings, so a season's shape - dead Tuesdays, heavy Saturdays -
 * is visible without reading a single number.
 */
export function SalesCalendar() {
  const { t, locale } = useI18n();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [preset, setPreset] = useState<Preset>('month');
  const [selected, setSelected] = useState<string | null>(null);

  const range = useMemo(() => {
    const today = new Date();
    if (preset === 'month') {
      return { from: isoDate(startOfMonth(cursor)), to: isoDate(endOfMonth(cursor)) };
    }
    const days = preset === 'last3' ? 3 : preset === 'last7' ? 7 : 30;
    return { from: isoDate(addDays(today, -(days - 1))), to: isoDate(today) };
  }, [preset, cursor]);

  const report = useQuery<SalesReport>(
    () => api.sales(range.from, range.to),
    [range.from, range.to],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, SalesDay>();
    for (const day of report.data?.days ?? []) {
      map.set(String(day.business_date).slice(0, 10), day);
    }
    return map;
  }, [report.data]);

  const peak = useMemo(
    () => Math.max(1, ...(report.data?.days ?? []).map((d) => Number(d.gross_cents))),
    [report.data],
  );

  const selectedDay = selected ? byDate.get(selected) ?? null : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="display text-2xl font-semibold text-cal-900">{t('sales.title')}</h1>
        <Segmented
          value={preset}
          onChange={(value) => {
            setPreset(value);
            setSelected(null);
          }}
          size="sm"
          className="ml-auto"
          options={[
            { value: 'month', label: t('sales.thisMonth') },
            { value: 'last3', label: t('sales.last3') },
            { value: 'last7', label: t('sales.last7') },
            { value: 'last30', label: t('sales.last30') },
          ]}
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={t('sales.periodTotal')}
          value={euro(report.data?.totals.gross_cents ?? 0, locale)}
          icon="coins"
          primary
          loading={report.loading}
        />
        <Metric
          label={t('sales.perDay')}
          value={euro(report.data?.averages.per_day_cents ?? 0, locale)}
          icon="calendar"
          loading={report.loading}
        />
        <Metric
          label={t('sales.perCover')}
          value={euro(report.data?.averages.per_cover_cents ?? 0, locale)}
          icon="users"
          hint={`${report.data?.totals.covers_count ?? 0} ${t('sales.covers').toLowerCase()}`}
          loading={report.loading}
        />
        <Metric
          label={t('sales.bills')}
          value={String(report.data?.totals.bills_count ?? 0)}
          icon="receipt"
          hint={`${report.data?.trading_days ?? 0} ${t('sales.tradingDays').toLowerCase()}`}
          loading={report.loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="rounded-plate bg-white p-4 shadow-plate hairline sm:p-5">
          {preset === 'month' ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
                  className="grid size-9 place-items-center rounded-xl text-cal-500 transition hover:bg-cal-100"
                  aria-label="←"
                >
                  <Icon name="chevron-left" className="size-5" />
                </button>
                <p className="text-base font-semibold text-cal-900 capitalize">
                  {monthLabel(cursor, locale)}
                </p>
                <button
                  onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                  className="grid size-9 place-items-center rounded-xl text-cal-500 transition hover:bg-cal-100"
                  aria-label="→"
                >
                  <Icon name="chevron-right" className="size-5" />
                </button>
              </div>

              <MonthGrid
                cursor={cursor}
                byDate={byDate}
                peak={peak}
                selected={selected}
                onSelect={setSelected}
              />
            </>
          ) : (
            <DayBars days={report.data?.days ?? []} peak={peak} onSelect={setSelected} />
          )}
        </div>

        <DayDetail day={selectedDay} report={report.data} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------

function MonthGrid({
  cursor, byDate, peak, selected, onSelect,
}: {
  cursor: Date;
  byDate: Map<string, SalesDay>;
  peak: number;
  selected: string | null;
  onSelect: (iso: string | null) => void;
}) {
  const { locale } = useI18n();
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  // Monday-first, as the Portuguese calendar runs.
  const lead = mondayIndex(first);
  const cells: Array<Date | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: last.getDate() }, (_, i) =>
      new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ];
  const todayIso = isoDate(new Date());

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {weekdayInitials(locale).map((day, i) => (
          <div key={i} className="text-center text-[11px] font-medium text-cal-400 capitalize">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((date, index) => {
          if (!date) return <div key={`pad-${index}`} />;
          const iso = isoDate(date);
          const day = byDate.get(iso);
          const gross = Number(day?.gross_cents ?? 0);
          // Colour depth encodes takings against the period's best day.
          const intensity = gross > 0 ? 0.14 + (gross / peak) * 0.82 : 0;
          const isToday = iso === todayIso;

          return (
            <motion.button
              key={iso}
              layout
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelect(selected === iso ? null : iso)}
              className={cn(
                'relative aspect-square rounded-xl p-1.5 text-left transition',
                gross > 0 ? 'text-white' : 'bg-cal-50 text-cal-400',
                selected === iso && 'ring-2 ring-barro-500 ring-offset-2',
                isToday && selected !== iso && 'ring-2 ring-azul-300',
              )}
              style={
                gross > 0
                  ? { background: `color-mix(in oklab, var(--color-azul-600) ${intensity * 100}%, white)` }
                  : undefined
              }
            >
              <span
                className={cn(
                  'text-[11px] font-semibold tnum',
                  gross > 0 && intensity < 0.45 && 'text-azul-900',
                )}
              >
                {date.getDate()}
              </span>
              {gross > 0 && (
                <span
                  className={cn(
                    'absolute inset-x-1 bottom-1 truncate text-[10px] leading-none font-medium tnum',
                    intensity < 0.45 ? 'text-azul-800' : 'text-white/90',
                  )}
                >
                  {euroCompact(gross, locale)}
                </span>
              )}
              {day && !day.is_closed && gross > 0 && (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-400" />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function DayBars({
  days, peak, onSelect,
}: {
  days: SalesDay[];
  peak: number;
  onSelect: (iso: string) => void;
}) {
  const { locale } = useI18n();
  return (
    <div className="flex h-64 items-end gap-2">
      {days.map((day, i) => {
        const iso = String(day.business_date).slice(0, 10);
        const gross = Number(day.gross_cents);
        return (
          <motion.button
            key={iso}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(4, (gross / peak) * 100)}%` }}
            transition={{ ...SPRING, delay: i * 0.03 }}
            onClick={() => onSelect(iso)}
            className="group relative min-w-0 flex-1 rounded-t-lg bg-azul-500 transition-colors hover:bg-azul-600"
          >
            <span className="absolute inset-x-0 -top-6 truncate text-center text-[10px] font-medium text-cal-600 tnum opacity-0 transition group-hover:opacity-100">
              {euroCompact(gross, locale)}
            </span>
            <span className="absolute inset-x-0 -bottom-5 truncate text-center text-[10px] text-cal-400 tnum">
              {iso.slice(8)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function DayDetail({
  day, report,
}: {
  day: SalesDay | null;
  report: SalesReport | null;
}) {
  const { t, locale } = useI18n();

  if (!day) {
    return (
      <div className="rounded-plate bg-white p-5 text-center shadow-plate hairline">
        <Icon name="calendar" className="mx-auto size-8 text-cal-300" />
        <p className="mt-3 text-sm text-cal-500">{t('sales.selectDay')}</p>
        {report && (
          <dl className="mt-5 space-y-2 border-t border-cal-100 pt-4 text-left text-sm">
            <div className="flex justify-between text-cal-600">
              <dt>{t('sales.tradingDays')}</dt>
              <dd className="font-medium tnum">{report.trading_days}</dd>
            </div>
            <div className="flex justify-between text-cal-600">
              <dt>{t('sales.perBill')}</dt>
              <dd className="font-medium tnum">
                {euro(report.averages.per_bill_cents, locale)}
              </dd>
            </div>
          </dl>
        )}
      </div>
    );
  }

  const iso = String(day.business_date).slice(0, 10);
  const payments = Object.entries(day.by_payment ?? {}) as Array<[string, number]>;
  const paymentTotal = payments.reduce((s, [, v]) => s + Number(v), 0) || 1;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={iso}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={SPRING}
        className="overflow-hidden rounded-plate bg-white shadow-plate hairline"
      >
        <div className="relative overflow-hidden bg-azul-600 p-5 text-white">
          <div className="azulejo-soft absolute inset-0 opacity-[0.12]" />
          <div className="relative">
            <p className="text-xs text-azul-200 capitalize">{dateLong(iso, locale)}</p>
            <p className="mt-1 text-3xl font-semibold tnum">
              {euro(Number(day.gross_cents), locale)}
            </p>
            <span
              className={cn(
                'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                day.is_closed ? 'bg-oliva-500/30 text-oliva-100' : 'bg-amber-400/25 text-amber-100',
              )}
            >
              <Icon name={day.is_closed ? 'check' : 'clock'} className="size-3" />
              {day.is_closed ? t('sales.closed') : t('sales.notClosed')}
            </span>
          </div>
        </div>

        <dl className="space-y-2 px-5 py-4 text-sm">
          <div className="flex justify-between text-cal-600">
            <dt>{t('common.iva')}</dt>
            <dd className="font-medium tnum">{euro(Number(day.vat_cents), locale)}</dd>
          </div>
          <div className="flex justify-between text-cal-600">
            <dt>{t('sales.bills')}</dt>
            <dd className="font-medium tnum">{day.bills_count}</dd>
          </div>
          <div className="flex justify-between text-cal-600">
            <dt>{t('sales.covers')}</dt>
            <dd className="font-medium tnum">{day.covers_count}</dd>
          </div>
        </dl>

        {payments.length > 0 && (
          <div className="border-t border-cal-100 px-5 py-4">
            <p className="mb-2.5 text-xs font-semibold tracking-wide text-cal-500 uppercase">
              {t('sales.byPayment')}
            </p>
            <div className="space-y-2">
              {payments.map(([methodCode, value]) => (
                <div key={methodCode}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-cal-600">
                      {t(`billing.method.${methodCode}` as never)}
                    </span>
                    <span className="font-medium text-cal-800 tnum">
                      {euro(Number(value), locale)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-cal-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(Number(value) / paymentTotal) * 100}%` }}
                      transition={{ ...SPRING, damping: 26 }}
                      className="h-full rounded-full bg-azul-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function Metric({
  label, value, icon, hint, primary, loading,
}: {
  label: string;
  value: string;
  icon: 'coins' | 'calendar' | 'users' | 'receipt';
  hint?: string;
  primary?: boolean;
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-24" />;
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
        <p className={cn('text-xs', primary ? 'text-azul-200' : 'text-cal-400')}>{hint}</p>
      )}
    </div>
  );
}
