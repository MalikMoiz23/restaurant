import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api, type KdsOrder, type FloorTable, type CallReason } from '../../lib/api';
import { useQuery, useLiveEvents, useConnection } from '../../lib/live';
import { euro, elapsed, clock } from '../../lib/format';
import { Icon, type IconName } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { useAuth } from '../../store';
import {
  Button, ConnectionPill, EmptyState, Skeleton, StatusDot, SPRING, cn, useToast,
} from '../../ui';
import { PinLogin } from '../counter/PinLogin';

const REASON_ICON: Record<CallReason, IconName> = {
  help: 'bell',
  water: 'WATER' as IconName,
  bill: 'receipt',
  cleaning: 'broom',
  cutlery: 'UTENSILS',
};

/**
 * The waiter's device.
 *
 * Carried in an apron on the floor, held in one hand, glanced at
 * between tables - so it is a single scrolling column of large targets,
 * not a dashboard. It answers only the two questions a waiter has
 * while walking: who needs me, and what do I carry out.
 *
 * The counter app shows the same calls, but a waiter should not have to
 * walk back to the till to discover a table is waiting.
 */
export function WaiterApp() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const connection = useConnection();
  const staff = useAuth((s) => s.staff);
  const signOut = useAuth((s) => s.signOut);

  const [alertsOn, setAlertsOn] = useState(false);
  const [, tick] = useState(0);

  const calls = useQuery(() => api.waiterCalls(), [], { enabled: !!staff });
  const orders = useQuery<KdsOrder[]>(() => api.kds('all'), [], { enabled: !!staff });
  const tables = useQuery<FloorTable[]>(() => api.tables(), [], { enabled: !!staff });

  // Keeps the "waiting 4m 12s" readouts honest without refetching.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  const reloadAll = useCallback(() => {
    calls.reload();
    orders.reload();
    tables.reload();
  }, [calls.reload, orders.reload, tables.reload]);

  // A waiter is not looking at the screen when a table calls, so the
  // alert has to reach them physically. Vibration needs a prior user
  // gesture on most browsers, which is what the alerts toggle buys.
  const alertsRef = useRef(alertsOn);
  alertsRef.current = alertsOn;

  useLiveEvents(
    ['waiter.call', 'waiter.ack', 'order.status', 'order.created', 'table.status', 'session.closed', 'bill.finalized'],
    useCallback((event) => {
      reloadAll();

      if (event.type === 'waiter.call') {
        toast({
          tone: 'warn',
          title: t('waiter.newCall', { n: event.tableNumber }),
          body: t(`call.reason.${event.reason}` as never),
          icon: 'bell',
        });
        if (alertsRef.current) buzz([220, 90, 220]);
      }

      if (event.type === 'order.status' && event.status === 'ready') {
        toast({
          tone: 'success',
          title: t('waiter.orderReady', { n: event.tableNumber }),
          icon: 'check',
        });
        if (alertsRef.current) buzz([120]);
      }
    }, [reloadAll, toast, t]),
  );

  if (!staff) return <PinLogin />;

  const openCalls = calls.data ?? [];
  const ready = (orders.data ?? []).filter((o) => o.status === 'ready');
  const openTables = (tables.data ?? []).filter((tbl) => tbl.session_id || tbl.status === 'needs_cleaning');

  return (
    <div className="min-h-dvh bg-cal-100 pb-10">
      <header className="sticky top-0 z-30 border-b border-cal-200 bg-cal-50/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-oliva-500 text-white"
            aria-label={t('common.back')}
          >
            <Icon name="users" className="size-5" />
          </button>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-cal-900">{t('waiter.title')}</p>
            <p className="truncate text-xs text-cal-500">
              {staff.name} · {t(`auth.roles.${staff.role}` as never)}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ConnectionPill
              state={connection}
              labels={{ online: t('net.online'), connecting: t('net.connecting'), offline: t('net.offline') }}
            />
            <button
              onClick={() => {
                const next = !alertsOn;
                setAlertsOn(next);
                // Fire one buzz on enabling, which also satisfies the
                // browser's "needs a gesture first" rule.
                if (next) buzz([60]);
              }}
              title={alertsOn ? t('waiter.alertOn') : t('waiter.alertHint')}
              className={cn(
                'grid size-10 place-items-center rounded-xl transition',
                alertsOn
                  ? 'bg-oliva-500 text-white'
                  : 'bg-white text-cal-500 hairline hover:bg-cal-50',
              )}
            >
              <Icon name={alertsOn ? 'bell' : 'bell'} className="size-5" />
            </button>
            <button
              onClick={signOut}
              className="grid size-10 place-items-center rounded-xl bg-white text-cal-500 hairline transition hover:bg-cal-50 hover:text-barro-600"
              aria-label={t('auth.signOut')}
            >
              <Icon name="lock" className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-5">
        {/* ---- Calls: always first, because they are the interruption --- */}
        <section>
          <SectionHead
            icon="bell"
            title={t('waiter.calls')}
            count={openCalls.length}
            tone={openCalls.length > 0 ? 'alert' : 'quiet'}
          />

          {calls.loading ? (
            <Skeleton className="h-24" />
          ) : openCalls.length === 0 ? (
            <div className="rounded-plate bg-white shadow-plate hairline">
              <EmptyState icon="check" title={t('waiter.callsNone')} body={t('waiter.callsNoneBody')} />
            </div>
          ) : (
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {openCalls.map((call) => {
                  const waitedSec = (Date.now() - new Date(call.created_at).getTime()) / 1000;
                  const urgent = waitedSec > 180;
                  return (
                    <motion.li
                      key={call.id}
                      layout
                      initial={{ opacity: 0, y: -10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                      transition={SPRING}
                      className={cn(
                        'overflow-hidden rounded-plate bg-white shadow-plate',
                        urgent ? 'ring-2 ring-barro-500' : 'hairline',
                      )}
                    >
                      <div className="flex items-center gap-3.5 p-4">
                        <span
                          className={cn(
                            'relative grid size-14 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white tnum',
                            urgent ? 'bg-barro-500' : 'bg-azul-600',
                          )}
                        >
                          {call.table_number}
                          {urgent && <span className="anim-ring absolute inset-0 rounded-2xl" />}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-base font-semibold text-cal-900">
                            <Icon name={REASON_ICON[call.reason] ?? 'bell'} className="size-4.5 shrink-0" />
                            {t(`call.reason.${call.reason}` as never)}
                          </p>
                          <p className={cn('text-sm', urgent ? 'font-medium text-barro-600' : 'text-cal-500')}>
                            {call.zone} · {t('waiter.waiting', { t: elapsed(waitedSec) })}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          try {
                            await api.ackCall(call.id);
                            calls.reload();
                          } catch {
                            toast({ tone: 'error', title: t('common.somethingWrong'), icon: 'alert' });
                          }
                        }}
                        className={cn(
                          'w-full py-3.5 text-base font-semibold text-white transition active:scale-[0.99]',
                          urgent ? 'bg-barro-500 hover:bg-barro-600' : 'bg-azul-600 hover:bg-azul-700',
                        )}
                      >
                        {t('waiter.onMyWay')}
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {/* ---- Food waiting to be run out ----------------------------- */}
        <section>
          <SectionHead
            icon="UTENSILS"
            title={t('waiter.toDeliver')}
            count={ready.length}
            tone={ready.length > 0 ? 'good' : 'quiet'}
          />

          {orders.loading ? (
            <Skeleton className="h-24" />
          ) : ready.length === 0 ? (
            <div className="rounded-plate bg-white shadow-plate hairline">
              <EmptyState
                icon="clock"
                title={t('waiter.toDeliverNone')}
                body={t('waiter.toDeliverNoneBody')}
              />
            </div>
          ) : (
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {ready.map((order) => (
                  <motion.li
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: -10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                    transition={SPRING}
                    className="overflow-hidden rounded-plate bg-white shadow-plate ring-2 ring-oliva-500"
                  >
                    <div className="flex items-start gap-3.5 p-4">
                      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-oliva-500 text-xl font-bold text-white tnum">
                        {order.table_number}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-cal-900">
                          {t('common.tableN', { n: order.table_number })}
                        </p>
                        <p className="text-sm text-cal-500">
                          {order.zone_name} · {t('orders.orderN', { n: order.seq })}
                        </p>

                        <ul className="mt-2 space-y-1">
                          {order.items.map((line) => (
                            <li key={line.id} className="flex gap-2 text-sm text-cal-700">
                              <span className="w-6 shrink-0 font-semibold text-cal-500 tnum">
                                {line.qty}×
                              </span>
                              <span className="min-w-0 flex-1">{line.name}</span>
                              {line.seatNo && (
                                <span className="shrink-0 text-xs text-cal-400">
                                  Lugar {line.seatNo}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>

                        {order.note && (
                          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                            <Icon name="info" className="mt-px size-3.5 shrink-0" />
                            {order.note}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        try {
                          await api.setOrderStatus(order.id, 'served');
                          orders.reload();
                        } catch {
                          toast({ tone: 'error', title: t('common.somethingWrong'), icon: 'alert' });
                        }
                      }}
                      className="w-full bg-oliva-500 py-3.5 text-base font-semibold text-white transition active:scale-[0.99] hover:bg-oliva-600"
                    >
                      {t('waiter.deliver')}
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {/* ---- Compact table list, for context rather than action ----- */}
        <section>
          <SectionHead icon="grid" title={t('waiter.tables')} count={openTables.length} tone="quiet" />

          {tables.loading ? (
            <Skeleton className="h-32" />
          ) : openTables.length === 0 ? (
            <div className="rounded-plate bg-white shadow-plate hairline">
              <EmptyState icon="grid" title={t('waiter.tablesNone')} />
            </div>
          ) : (
            <ul className="overflow-hidden rounded-plate bg-white shadow-plate hairline">
              {openTables.map((tbl) => (
                <li
                  key={tbl.id}
                  className="flex items-center gap-3 border-b border-cal-100 px-4 py-3 last:border-0"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cal-100 text-base font-bold text-cal-700 tnum">
                    {tbl.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-cal-800">
                      <StatusDot status={tbl.status} />
                      {t(`counter.tableStatus.${tbl.status}` as never)}
                    </p>
                    <p className="text-xs text-cal-400">
                      {locale === 'pt' ? tbl.zone_name_pt : tbl.zone_name_en}
                      {tbl.opened_at && ` · ${clock(tbl.opened_at, locale)}`}
                    </p>
                  </div>
                  {tbl.status === 'needs_cleaning' ? (
                    <Button
                      size="sm"
                      variant="quiet"
                      icon="broom"
                      onClick={async () => {
                        await api.setTableStatus(tbl.id, 'free');
                        tables.reload();
                      }}
                    >
                      {t('counter.markClean')}
                    </Button>
                  ) : (
                    <span className="shrink-0 text-sm font-semibold text-cal-900 tnum">
                      {euro(tbl.gross_cents, locale)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {!alertsOn && (
          <p className="flex items-start gap-2 rounded-2xl bg-azul-50 p-3.5 text-sm text-azul-800">
            <Icon name="info" className="mt-0.5 size-4 shrink-0" />
            {t('waiter.alertHint')}
          </p>
        )}
      </main>
    </div>
  );
}

function SectionHead({
  icon, title, count, tone,
}: {
  icon: IconName;
  title: string;
  count: number;
  tone: 'alert' | 'good' | 'quiet';
}) {
  const tones = {
    alert: 'bg-barro-500 text-white',
    good: 'bg-oliva-500 text-white',
    quiet: 'bg-cal-200 text-cal-600',
  };
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <Icon name={icon} className="size-5 text-cal-500" />
      <h2 className="text-base font-semibold text-cal-900">{title}</h2>
      <span
        className={cn(
          'ml-auto grid min-w-6 place-items-center rounded-full px-2 py-0.5 text-xs font-bold tnum',
          tones[tone],
        )}
      >
        {count}
      </span>
    </div>
  );
}

/** Vibrates where supported; silently does nothing where it is not. */
function buzz(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported or blocked */
  }
}
