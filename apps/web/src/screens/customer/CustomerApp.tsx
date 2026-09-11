import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api, type SessionDetail, type Menu } from '../../lib/api';
import { useQuery, useLiveEvents, useConnection } from '../../lib/live';
import { useI18n } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { useCart, cartCount } from '../../store';
import {
  Button, ConnectionPill, EmptyState, Skeleton, SPRING, cn,
} from '../../ui';
import { Welcome } from './Welcome';
import { MenuBrowser } from './MenuBrowser';
import { CartSheet } from './CartSheet';
import { OrdersView } from './OrdersView';
import { BillView } from './BillView';
import { WaiterCallSheet } from './WaiterCall';

type Tab = 'menu' | 'orders' | 'bill';

/**
 * The guest-facing tablet. One table, one session, no login: the whole
 * point is that someone sits down and can order without an account.
 */
export function CustomerApp() {
  const { tableNumber: raw } = useParams();
  const navigate = useNavigate();
  const tableNumber = Number(raw);
  const { t, locale } = useI18n();
  const connection = useConnection();

  const [tab, setTab] = useState<Tab>('menu');
  const [cartOpen, setCartOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  const setTable = useCart((s) => s.setTable);
  const lines = useCart((s) => s.lines);
  const count = cartCount(lines);

  useEffect(() => {
    if (Number.isFinite(tableNumber)) setTable(tableNumber);
  }, [tableNumber, setTable]);

  const menu = useQuery<Menu>(() => api.menu(locale), [locale]);
  const session = useQuery<SessionDetail | null>(
    () => api.sessionByTable(tableNumber).catch((err) => {
      // A table with no open session is the normal cold-start case,
      // not an error: the welcome screen handles it.
      if (err?.status === 404) return null;
      throw err;
    }),
    [tableNumber],
  );

  // The kitchen advancing a ticket has to show up on the guest's tablet
  // without them touching anything.
  const reloadSession = session.reload;
  useLiveEvents(
    ['order.created', 'order.status', 'bill.finalized', 'session.closed', 'waiter.ack', 'waiter.call'],
    useCallback((event) => {
      if ('tableNumber' in event && event.tableNumber === tableNumber) reloadSession();
    }, [tableNumber, reloadSession]),
  );

  const reloadMenu = menu.reload;
  useLiveEvents(['menu.updated'], useCallback(() => reloadMenu(), [reloadMenu]));

  const activeSession = session.data?.session ?? null;
  const isClosed = activeSession?.status === 'closed';

  const tabs: Array<{ key: Tab; label: string; icon: 'UTENSILS' | 'clock' | 'receipt'; badge?: number }> = useMemo(() => [
    { key: 'menu', label: t('menu.title'), icon: 'UTENSILS' },
    {
      key: 'orders',
      label: t('orders.title'),
      icon: 'clock',
      badge: session.data?.orders.filter((o) => o.status !== 'served' && o.status !== 'cancelled').length,
    },
    { key: 'bill', label: t('bill.title'), icon: 'receipt' },
  ], [t, session.data]);

  if (!Number.isFinite(tableNumber) || tableNumber <= 0) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cal-50 p-6">
        <EmptyState
          icon="alert"
          title={t('common.somethingWrong')}
          action={<Button onClick={() => navigate('/')}>{t('common.back')}</Button>}
        />
      </div>
    );
  }

  if (session.loading || menu.loading) {
    return <CustomerSkeleton />;
  }

  // No open session yet, or the last one was just closed out: greet the
  // guest and open a fresh one.
  if (!activeSession || isClosed) {
    return (
      <Welcome
        tableNumber={tableNumber}
        onOpened={() => {
          session.reload();
          setTab('menu');
        }}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cal-50">
      <header className="sticky top-0 z-30 border-b border-cal-200/80 bg-cal-50/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => navigate('/')}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-azul-600 text-white"
            aria-label={t('common.back')}
          >
            <Icon name="UTENSILS" className="size-5" strokeWidth={1.9} />
          </button>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-cal-900">
              {t('common.tableN', { n: tableNumber })}
            </p>
            <p className="truncate text-xs text-cal-500">
              {activeSession.guest_count}{' '}
              {activeSession.guest_count === 1 ? t('common.guest') : t('common.guests')}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ConnectionPill
              state={connection}
              labels={{ online: t('net.online'), connecting: t('net.connecting'), offline: t('net.offline') }}
            />
            <LanguageSwitch />
            <button
              onClick={() => setCallOpen(true)}
              className={cn(
                'relative inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition',
                session.data?.openCall
                  ? 'bg-barro-500 text-white'
                  : 'bg-white text-cal-700 hairline hover:bg-cal-100',
              )}
            >
              <Icon name="bell" className={cn('size-5', session.data?.openCall && 'anim-beat')} />
              <span className="hidden md:inline">
                {session.data?.openCall ? t('call.pending') : t('call.button')}
              </span>
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 px-4 pb-2 sm:px-6">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                'relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:px-5',
                tab === item.key ? 'text-azul-700' : 'text-cal-500 hover:text-cal-700',
              )}
            >
              {tab === item.key && (
                <motion.span
                  layoutId="customer-tab"
                  transition={SPRING}
                  className="absolute inset-0 rounded-xl bg-white shadow-plate"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon name={item.icon} className="size-4.5" />
                {item.label}
                {!!item.badge && (
                  <span className="rounded-full bg-barro-500 px-1.5 text-[11px] font-semibold text-white tnum">
                    {item.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'menu' && menu.data && (
              <MenuBrowser menu={menu.data} onOpenCart={() => setCartOpen(true)} />
            )}
            {tab === 'orders' && session.data && (
              <OrdersView detail={session.data} onBrowse={() => setTab('menu')} />
            )}
            {tab === 'bill' && session.data && (
              <BillView
                detail={session.data}
                tableNumber={tableNumber}
                onBrowse={() => setTab('menu')}
                onRequestBill={() => setCallOpen(true)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Cart bar. Rides above the safe area so it clears a tablet's
          home indicator, and only appears when there is something in it. */}
      <AnimatePresence>
        {count > 0 && tab === 'menu' && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={SPRING}
            className="fixed inset-x-0 bottom-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto max-w-2xl">
              <Button
                size="xl"
                variant="primary"
                block
                onClick={() => setCartOpen(true)}
                className="shadow-lift"
              >
                <span className="grid size-7 place-items-center rounded-full bg-white/20 text-sm font-bold tnum">
                  {count}
                </span>
                {t('cart.title')}
                <Icon name="chevron-right" className="ml-auto size-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        sessionId={activeSession.id}
        onSent={() => {
          setCartOpen(false);
          session.reload();
          setTab('orders');
        }}
      />

      <WaiterCallSheet
        open={callOpen}
        onClose={() => setCallOpen(false)}
        tableNumber={tableNumber}
        pending={session.data?.openCall ?? null}
        onCalled={() => session.reload()}
      />
    </div>
  );
}

function LanguageSwitch() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const codes = ['pt', 'en', 'es', 'fr'] as const;
  const flags = { pt: '🇵🇹', en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷' };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-sm hairline hover:bg-cal-100"
        aria-label="Idioma"
      >
        <span aria-hidden>{flags[locale]}</span>
        <span className="font-medium uppercase">{locale}</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={SPRING}
              className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-2xl bg-white p-1 shadow-lift hairline"
            >
              {codes.map((code) => (
                <button
                  key={code}
                  onClick={() => {
                    setLocale(code);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition',
                    locale === code ? 'bg-azul-50 font-medium text-azul-700' : 'hover:bg-cal-100',
                  )}
                >
                  <span aria-hidden>{flags[code]}</span>
                  {{ pt: 'Português', en: 'English', es: 'Español', fr: 'Français' }[code]}
                  {locale === code && <Icon name="check" className="ml-auto size-4" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function CustomerSkeleton() {
  return (
    <div className="min-h-dvh bg-cal-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="ml-auto h-10 w-24" />
        </div>
        <Skeleton className="mt-4 h-12 w-full" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      </div>
    </div>
  );
}
