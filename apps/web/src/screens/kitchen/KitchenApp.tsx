import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api, type KdsOrder, type Station, type OrderStatus } from '../../lib/api';
import { useQuery, useLiveEvents, useConnection } from '../../lib/live';
import { clock, elapsed } from '../../lib/format';
import { Icon } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { ConnectionPill, EmptyState, Segmented, SPRING, cn, useToast } from '../../ui';

type Lane = 'received' | 'preparing' | 'ready';
const LANES: Lane[] = ['received', 'preparing', 'ready'];

/**
 * Kitchen display.
 *
 * Read from two metres away by someone with their hands full, so: dark
 * ground, oversized type, three fixed lanes, and one big button per
 * ticket. Colour is reserved for how long a ticket has been waiting -
 * nothing else on this screen is allowed to compete with that signal.
 */
export function KitchenApp() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const connection = useConnection();

  const [station, setStation] = useState<Station | 'all'>('all');
  // Ticks once a second purely so the age readouts stay honest without
  // refetching the whole board.
  const [, setTick] = useState(0);

  const orders = useQuery<KdsOrder[]>(() => api.kds(station), [station]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const reload = orders.reload;
  useLiveEvents(
    ['order.created', 'order.status', 'bill.finalized'],
    useCallback((event) => {
      reload();
      if (event.type === 'order.created') {
        toast({
          tone: 'info',
          title: t('kds.newOrder', { n: event.tableNumber }),
          icon: 'bell',
        });
      }
    }, [reload, toast, t]),
  );

  const byLane = useMemo(() => {
    const map: Record<Lane, KdsOrder[]> = { received: [], preparing: [], ready: [] };
    for (const order of orders.data ?? []) {
      if (order.status in map) map[order.status as Lane].push(order);
    }
    return map;
  }, [orders.data]);

  async function advance(order: KdsOrder, next: OrderStatus) {
    try {
      await api.setOrderStatus(order.id, next);
      orders.reload();
    } catch {
      toast({ tone: 'error', title: t('common.somethingWrong'), icon: 'alert' });
    }
  }

  const total = orders.data?.length ?? 0;
  const covers = (orders.data ?? []).reduce((s, o) => s + o.guest_count, 0);

  return (
    <div className="theme-kds flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-azul-800 bg-azul-950/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => navigate('/')}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-azul-800 text-azul-200 transition hover:bg-azul-700"
            aria-label={t('common.back')}
          >
            <Icon name="kitchen" className="size-5" />
          </button>

          <div>
            <h1 className="display text-xl leading-none font-semibold text-cal-50">
              {t('kds.title')}
            </h1>
            <p className="mt-1 text-xs text-azul-300 tnum">
              {t('kds.ordersCount', { n: total })} · {t('kds.covers', { n: covers })}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <ConnectionPill
              state={connection}
              labels={{ online: t('net.online'), connecting: t('net.connecting'), offline: t('net.offline') }}
              dark
            />
            <span className="hidden text-lg font-semibold text-cal-100 tnum sm:block">
              {clock(new Date(), locale)}
            </span>
          </div>

          <div className="w-full sm:w-auto">
            <Segmented
              value={station}
              onChange={setStation}
              size="sm"
              dark
              options={[
                { value: 'all', label: t('kds.stationAll') },
                { value: 'cozinha', label: t('kds.stations.cozinha') },
                { value: 'grelha', label: t('kds.stations.grelha') },
                { value: 'bar', label: t('kds.stations.bar') },
                { value: 'pastelaria', label: t('kds.stations.pastelaria') },
              ]}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 p-3 sm:p-4">
        {total === 0 && !orders.loading ? (
          <div className="grid h-full place-items-center">
            <EmptyState dark icon="check" title={t('kds.quiet')} body={t('kds.quietHint')} />
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {LANES.map((lane) => (
              <section key={lane} className="flex flex-col rounded-2xl bg-azul-900/60 p-3">
                <header className="mb-3 flex items-center gap-2 px-1">
                  <span
                    className={cn(
                      'size-2.5 rounded-full',
                      lane === 'received' && 'bg-barro-400',
                      lane === 'preparing' && 'bg-amber-400',
                      lane === 'ready' && 'bg-oliva-400',
                    )}
                  />
                  <h2 className="text-sm font-semibold tracking-wide text-cal-100 uppercase">
                    {t(`kds.lane.${lane}` as never)}
                  </h2>
                  <span className="ml-auto rounded-full bg-azul-800 px-2 py-0.5 text-xs font-semibold text-azul-200 tnum">
                    {byLane[lane].length}
                  </span>
                </header>

                <div className="space-y-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {byLane[lane].map((order) => (
                      <Ticket
                        key={order.id}
                        order={order}
                        lane={lane}
                        onAdvance={advance}
                      />
                    ))}
                  </AnimatePresence>

                  {byLane[lane].length === 0 && (
                    <p className="rounded-xl border border-dashed border-azul-800 py-8 text-center text-sm text-azul-400">
                      {t('kds.laneEmpty')}
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------

/**
 * Age thresholds. Under five minutes a ticket is simply new; past ten
 * it is late and the whole card carries the warning, because at that
 * point the table is noticing too.
 */
function ageTone(order: KdsOrder) {
  const seconds = (Date.now() - new Date(order.placed_at).getTime()) / 1000;
  const minutes = seconds / 60;
  if (minutes >= 18) return { key: 'late', ring: 'ring-barro-500', text: 'text-barro-300', bar: 'bg-barro-500' };
  if (minutes >= 10) return { key: 'warn', ring: 'ring-amber-500/70', text: 'text-amber-300', bar: 'bg-amber-500' };
  if (minutes >= 5) return { key: 'mid', ring: 'ring-azul-600', text: 'text-azul-200', bar: 'bg-azul-500' };
  return { key: 'fresh', ring: 'ring-oliva-500/60', text: 'text-oliva-300', bar: 'bg-oliva-500' };
}

function Ticket({
  order, lane, onAdvance,
}: {
  order: KdsOrder;
  lane: Lane;
  onAdvance: (order: KdsOrder, next: OrderStatus) => void;
}) {
  const { t, locale } = useI18n();
  const tone = ageTone(order);
  const seconds = Math.max(0, (Date.now() - new Date(order.placed_at).getTime()) / 1000);

  const next: Record<Lane, { status: OrderStatus; label: string }> = {
    received: { status: 'preparing', label: t('kds.start') },
    preparing: { status: 'ready', label: t('kds.ready') },
    ready: { status: 'served', label: t('kds.served') },
  };

  const back: Partial<Record<Lane, OrderStatus>> = {
    preparing: 'received',
    ready: 'preparing',
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.94, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
      transition={SPRING}
      className={cn(
        'overflow-hidden rounded-2xl bg-azul-800 ring-2',
        tone.ring,
        // A brand-new ticket pulses a few times, then settles.
        lane === 'received' && seconds < 20 && 'anim-ring',
      )}
    >
      <div className={cn('h-1 w-full', tone.bar)} />

      <div className="flex items-start gap-3 px-3.5 pt-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-cal-50 text-xl font-bold text-azul-900 tnum">
          {order.table_number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-cal-50">
            {t('common.tableN', { n: order.table_number })}
          </p>
          <p className="truncate text-xs text-azul-300">
            {order.zone_name} · {t('orders.orderN', { n: order.seq })} ·{' '}
            {t('kds.covers', { n: order.guest_count })}
          </p>
        </div>
        <div className="text-right">
          <p className={cn('text-lg font-bold tnum', tone.text)}>{elapsed(seconds)}</p>
          <p className="text-[11px] text-azul-400">{clock(order.placed_at, locale)}</p>
        </div>
      </div>

      {tone.key === 'late' && (
        <p className="mx-3.5 mt-2 rounded-lg bg-barro-500/20 px-2 py-1 text-center text-xs font-semibold text-barro-200 uppercase">
          {t('kds.late')}
        </p>
      )}

      <ul className="mt-3 space-y-1.5 px-3.5">
        {order.items.map((line) => (
          <li key={line.id} className="flex items-start gap-2.5 rounded-lg bg-azul-900/70 px-2.5 py-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-cal-50 text-sm font-bold text-azul-900 tnum">
              {line.qty}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-snug font-medium text-cal-50">{line.name}</p>
              {line.note && (
                <p className="mt-0.5 inline-flex items-start gap-1 rounded bg-barro-500/25 px-1.5 py-0.5 text-xs font-medium text-barro-200">
                  <Icon name="alert" className="mt-px size-3 shrink-0" />
                  {line.note}
                </p>
              )}
              {line.seatNo && (
                <p className="text-[11px] text-azul-400">Lugar {line.seatNo}</p>
              )}
            </div>
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-azul-300 uppercase">
              {t(`kds.stations.${line.station}` as never)}
            </span>
          </li>
        ))}
      </ul>

      {order.note && (
        <p className="mx-3.5 mt-2 flex items-start gap-2 rounded-lg bg-amber-500/15 px-2.5 py-2 text-sm text-amber-200">
          <Icon name="info" className="mt-0.5 size-4 shrink-0" />
          {order.note}
        </p>
      )}

      <div className="flex gap-2 p-3.5">
        {back[lane] && (
          <button
            onClick={() => onAdvance(order, back[lane]!)}
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-azul-700 text-azul-200 transition hover:bg-azul-600 active:scale-95"
            aria-label={t('kds.undo')}
          >
            <Icon name="chevron-left" className="size-5" />
          </button>
        )}
        <button
          onClick={() => onAdvance(order, next[lane].status)}
          className={cn(
            'h-12 flex-1 rounded-xl text-base font-semibold transition active:scale-[0.98]',
            lane === 'ready'
              ? 'bg-oliva-500 text-white hover:bg-oliva-600'
              : 'bg-cal-50 text-azul-900 hover:bg-white',
          )}
        >
          {next[lane].label}
        </button>
      </div>
    </motion.article>
  );
}
