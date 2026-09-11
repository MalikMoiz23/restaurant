import { useCallback, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../lib/api';
import { useQuery, useLiveEvents, useConnection } from '../../lib/live';
import { clock } from '../../lib/format';
import { Icon, type IconName } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { useAuth } from '../../store';
import { Button, ConnectionPill, SPRING, cn, useToast } from '../../ui';
import { PinLogin } from './PinLogin';
import { FloorPlan } from './FloorPlan';
import { BillPanel } from './BillPanel';
import { SalesCalendar } from './SalesCalendar';
import { CloseoutView } from './CloseoutView';
import { AuditView } from './AuditView';

/**
 * Counter and management shell. Everything behind a staff PIN, because
 * this is where money moves and where the audit trail has to name a
 * person rather than "the counter tablet".
 */
export function CounterApp() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const connection = useConnection();
  const toast = useToast();

  const staff = useAuth((s) => s.staff);
  const signOut = useAuth((s) => s.signOut);
  const [callsOpen, setCallsOpen] = useState(false);

  const calls = useQuery(() => api.waiterCalls(), [], { enabled: !!staff });

  const reloadCalls = calls.reload;
  useLiveEvents(
    ['waiter.call', 'waiter.ack'],
    useCallback((event) => {
      reloadCalls();
      if (event.type === 'waiter.call') {
        toast({
          tone: 'warn',
          title: t('common.tableN', { n: event.tableNumber }),
          body: t(`call.reason.${event.reason}` as never),
          icon: 'bell',
        });
      }
    }, [reloadCalls, toast, t]),
  );

  if (!staff) return <PinLogin />;

  const nav: Array<{ to: string; label: string; icon: IconName }> = [
    { to: '/balcao', label: t('counter.floor'), icon: 'grid' },
    { to: '/balcao/vendas', label: t('counter.sales'), icon: 'calendar' },
    { to: '/balcao/fecho', label: t('counter.closeout'), icon: 'coins' },
    { to: '/balcao/auditoria', label: t('counter.audit'), icon: 'shield' },
  ];

  const openCalls = calls.data ?? [];

  return (
    <div className="min-h-dvh bg-cal-100">
      <header className="sticky top-0 z-30 border-b border-cal-200 bg-cal-50/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => navigate('/')}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-barro-500 text-white"
            aria-label={t('common.back')}
          >
            <Icon name="counter" className="size-5" />
          </button>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-cal-900">{t('appName')}</p>
            <p className="truncate text-xs text-cal-500">
              {staff.name} · {t(`auth.roles.${staff.role}` as never)}
            </p>
          </div>

          <nav className="order-last flex w-full gap-1 overflow-x-auto no-scrollbar sm:order-none sm:ml-4 sm:w-auto">
            {nav.map((item) => {
              const active = item.to === '/balcao'
                ? location.pathname === '/balcao' || location.pathname.startsWith('/balcao/mesa')
                : location.pathname.startsWith(item.to);
              return (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className={cn(
                    'relative inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                    active ? 'text-azul-800' : 'text-cal-500 hover:text-cal-800',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="counter-nav"
                      transition={SPRING}
                      className="absolute inset-0 rounded-xl bg-white shadow-plate"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-2">
                    <Icon name={item.icon} className="size-4.5" />
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ConnectionPill
              state={connection}
              labels={{ online: t('net.online'), connecting: t('net.connecting'), offline: t('net.offline') }}
            />

            <button
              onClick={() => setCallsOpen((v) => !v)}
              className={cn(
                'relative inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition',
                openCalls.length
                  ? 'bg-barro-500 text-white'
                  : 'bg-white text-cal-600 hairline hover:bg-cal-50',
              )}
            >
              <Icon name="bell" className={cn('size-5', openCalls.length > 0 && 'anim-beat')} />
              {openCalls.length > 0 && (
                <span className="rounded-full bg-white/25 px-1.5 text-xs font-semibold tnum">
                  {openCalls.length}
                </span>
              )}
            </button>

            <button
              onClick={signOut}
              className="grid size-10 place-items-center rounded-xl bg-white text-cal-500 hairline transition hover:bg-cal-50 hover:text-barro-600"
              aria-label={t('auth.signOut')}
              title={t('auth.signOut')}
            >
              <Icon name="lock" className="size-5" />
            </button>
          </div>
        </div>

        {/* Waiter calls drop down over whatever screen is open: they are
            time-sensitive and must not depend on being on the right tab. */}
        <AnimatePresence>
          {callsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden border-t border-cal-200 bg-white"
            >
              <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
                {openCalls.length === 0 ? (
                  <p className="py-2 text-center text-sm text-cal-500">{t('counter.callsNone')}</p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {openCalls.map((call) => (
                      <li
                        key={call.id}
                        className="flex items-center gap-3 rounded-2xl bg-barro-50 p-3"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-barro-500 text-sm font-bold text-white tnum">
                          {call.table_number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-barro-800">
                            {t(`call.reason.${call.reason}` as never)}
                          </p>
                          <p className="text-xs text-barro-600">
                            {call.zone} · {clock(call.created_at, locale)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={async () => {
                            await api.ackCall(call.id);
                            calls.reload();
                          }}
                        >
                          {t('counter.ack')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <Routes>
          <Route index element={<FloorPlan />} />
          <Route path="mesa/:tableNumber" element={<BillPanel />} />
          <Route path="vendas" element={<SalesCalendar />} />
          <Route path="fecho" element={<CloseoutView />} />
          <Route path="auditoria" element={<AuditView />} />
          <Route path="*" element={<Navigate to="/balcao" replace />} />
        </Routes>
      </main>
    </div>
  );
}
