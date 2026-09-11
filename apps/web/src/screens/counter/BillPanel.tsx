import { useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  api, type BillView, type PaymentMethod, type Receipt as ReceiptData,
} from '../../lib/api';
import { useQuery, useLiveEvents } from '../../lib/live';
import { euro, clock, isValidNif } from '../../lib/format';
import { DishArt } from '../../lib/DishArt';
import { Icon, type IconName } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import {
  Badge, Button, EmptyState, Modal, Sheet, Skeleton, SPRING, cn, useToast,
} from '../../ui';

const METHODS: Array<{ code: PaymentMethod; icon: IconName }> = [
  { code: 'cash', icon: 'coins' },
  { code: 'mbway', icon: 'phone' },
  { code: 'multibanco', icon: 'bank' },
  { code: 'card', icon: 'card' },
];

/**
 * The cashier's screen: look a table up, read the itemised bill, split
 * it if the guests ask, take payment, issue the document.
 */
export function BillPanel() {
  const { tableNumber: raw } = useParams();
  const tableNumber = Number(raw);
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const toast = useToast();

  const bill = useQuery<BillView | null>(
    () => api.billByTable(tableNumber).catch((err) => {
      if (err?.status === 404) return null;
      throw err;
    }),
    [tableNumber],
  );

  const [splitOpen, setSplitOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const reload = bill.reload;
  useLiveEvents(
    ['order.created', 'order.status', 'bill.finalized'],
    useCallback((event) => {
      if ('tableNumber' in event && event.tableNumber === tableNumber) reload();
    }, [tableNumber, reload]),
  );

  if (bill.loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!bill.data) {
    return (
      <EmptyState
        icon="receipt"
        title={t('counter.noBill')}
        body={t('counter.noBillHint')}
        action={
          <Button variant="primary" onClick={() => navigate('/balcao')} icon="grid">
            {t('counter.floor')}
          </Button>
        }
      />
    );
  }

  const { session, lines, totals, splits, bill: billRow } = bill.data;
  const finalized = billRow?.status === 'finalized';

  // Group the bill by the order each line came in on, so the cashier can
  // see "this went out at 20:14" when a guest queries something.
  const byOrder = useMemo(() => {
    const groups = new Map<number, typeof lines>();
    for (const line of lines) {
      if (!groups.has(line.order_seq)) groups.set(line.order_seq, []);
      groups.get(line.order_seq)!.push(line);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [lines]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate('/balcao')}
          className="grid size-10 place-items-center rounded-xl bg-white text-cal-500 hairline transition hover:bg-cal-50"
          aria-label={t('common.back')}
        >
          <Icon name="chevron-left" className="size-5" />
        </button>
        <div>
          <h1 className="display text-2xl font-semibold text-cal-900">
            {t('billing.title', { n: session.table_number })}
          </h1>
          <p className="text-sm text-cal-500">
            {session.zone_name} · {session.guest_count} {t('common.guests')} ·{' '}
            {t('counter.since', { t: clock(session.opened_at, locale) })}
          </p>
        </div>
        {finalized && (
          <Badge tone="oliva" icon="check" className="ml-auto">
            {t('billing.receipt.finalizedAt', {
              t: clock(billRow!.finalized_at ?? '', locale),
            })}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="overflow-hidden rounded-plate bg-white shadow-plate hairline">
          {lines.length === 0 ? (
            <EmptyState icon="receipt" title={t('bill.noItems')} />
          ) : (
            byOrder.map(([seq, group]) => (
              <div key={seq}>
                <div className="flex items-center gap-2 border-b border-cal-100 bg-cal-50 px-4 py-2">
                  <span className="grid size-6 place-items-center rounded-md bg-azul-100 text-xs font-bold text-azul-700 tnum">
                    {seq}
                  </span>
                  <span className="text-xs font-semibold tracking-wide text-cal-500 uppercase">
                    {t('bill.orderN', { n: seq })}
                  </span>
                </div>
                <ul className="divide-y divide-cal-100">
                  {group.map((line) => (
                    <li key={line.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="size-10 shrink-0 overflow-hidden rounded-lg">
                        <DishArt glyph={line.glyph} seed={line.name_snapshot} className="size-full object-cover" />
                      </div>
                      <span className="w-8 shrink-0 text-sm font-semibold text-cal-500 tnum">
                        {line.qty}×
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-cal-900">
                          {line.name_snapshot}
                        </p>
                        <p className="text-xs text-cal-400 tnum">
                          {euro(line.unit_price_cents, locale)} ·{' '}
                          {t('common.ivaAt', { rate: Number(line.vat_rate) })}
                          {line.seat_no ? ` · Lugar ${line.seat_no}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-cal-900 tnum">
                        {euro(line.unit_price_cents * line.qty, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-plate bg-white shadow-plate hairline">
            <div className="relative overflow-hidden bg-azul-600 px-5 py-4 text-white">
              <div className="azulejo-soft absolute inset-0 opacity-[0.12]" />
              <div className="relative">
                <p className="text-sm text-azul-200">{t('common.toPay')}</p>
                <p className="text-3xl font-semibold tnum">
                  {euro(totals.total_cents, locale)}
                </p>
              </div>
            </div>

            <dl className="space-y-1.5 px-5 py-4 text-sm">
              <div className="flex justify-between text-cal-600">
                <dt>{t('common.subtotal')}</dt>
                <dd className="tnum">{euro(totals.subtotal_cents, locale)}</dd>
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
              <div className="flex justify-between border-t border-cal-200 pt-2 text-base font-semibold text-cal-900">
                <dt>{t('common.total')}</dt>
                <dd className="tnum">{euro(totals.total_cents, locale)}</dd>
              </div>
            </dl>

            {!finalized && lines.length > 0 && (
              <div className="space-y-2 border-t border-cal-100 p-4">
                <Button
                  variant="secondary"
                  size="lg"
                  block
                  icon="split"
                  onClick={() => setSplitOpen(true)}
                >
                  {t('billing.splitBill')}
                  {splits.length > 0 && (
                    <span className="ml-auto rounded-full bg-azul-100 px-2 text-xs text-azul-700 tnum">
                      {splits.length}
                    </span>
                  )}
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  block
                  icon="check"
                  onClick={() => setPayOpen(true)}
                >
                  {t('billing.finalize')}
                </Button>
              </div>
            )}
          </div>

          {splits.length > 0 && (
            <SplitList
              splits={splits}
              onPaid={() => bill.reload()}
              onToast={toast}
            />
          )}
        </div>
      </div>

      <SplitSheet
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        bill={bill.data}
        onApplied={() => {
          setSplitOpen(false);
          bill.reload();
        }}
      />

      <PaymentSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        bill={bill.data}
        onIssued={(issued) => {
          setPayOpen(false);
          setReceipt(issued);
          bill.reload();
        }}
      />

      <ReceiptModal
        receipt={receipt}
        onClose={() => {
          setReceipt(null);
          navigate('/balcao');
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------

function SplitList({
  splits, onPaid, onToast,
}: {
  splits: BillView['splits'];
  onPaid: () => void;
  onToast: ReturnType<typeof useToast>;
}) {
  const { t, locale } = useI18n();
  const outstanding = splits.filter((s) => !s.paid_at);
  const remaining = outstanding.reduce((sum, s) => sum + s.total_cents, 0);

  return (
    <div className="rounded-plate bg-white p-4 shadow-plate hairline">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-cal-800">
        <Icon name="split" className="size-4 text-cal-400" />
        {t('billing.split.title')}
      </h2>

      <ul className="space-y-2">
        {splits.map((split) => (
          <li
            key={split.id}
            className={cn(
              'flex items-center gap-3 rounded-xl p-2.5',
              split.paid_at ? 'bg-oliva-300/15' : 'bg-cal-100',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-cal-900">{split.label}</p>
              <p className="text-xs text-cal-500 tnum">
                {euro(split.total_cents, locale)}
                {split.payment_method && ` · ${t(`billing.method.${split.payment_method}` as never)}`}
              </p>
            </div>
            {split.paid_at ? (
              <Badge tone="oliva" icon="check">{t('billing.split.paid')}</Badge>
            ) : (
              <div className="flex gap-1">
                {METHODS.map((method) => (
                  <button
                    key={method.code}
                    title={t(`billing.method.${method.code}` as never)}
                    onClick={async () => {
                      await api.paySplit(split.id, method.code);
                      onToast({ tone: 'success', title: t('billing.split.paid'), icon: 'check' });
                      onPaid();
                    }}
                    className="grid size-9 place-items-center rounded-lg bg-white text-cal-600 hairline transition hover:bg-azul-50 hover:text-azul-700"
                  >
                    <Icon name={method.icon} className="size-4" />
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <p className="mt-3 flex justify-between border-t border-cal-200 pt-2.5 text-sm font-medium text-cal-700">
          <span>{t('billing.split.remaining')}</span>
          <span className="tnum">{euro(remaining, locale)}</span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------

type SplitMode = 'none' | 'even' | 'by_person' | 'by_item';

function SplitSheet({
  open, onClose, bill, onApplied,
}: {
  open: boolean;
  onClose: () => void;
  bill: BillView;
  onApplied: () => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [mode, setMode] = useState<SplitMode>('even');
  const [ways, setWays] = useState(Math.max(2, bill.session.guest_count));
  const [groups, setGroups] = useState<string[][]>([[], []]);
  const [busy, setBusy] = useState(false);

  const assignment = useMemo(() => {
    const map = new Map<string, number>();
    groups.forEach((ids, index) => ids.forEach((id) => map.set(id, index)));
    return map;
  }, [groups]);

  function assign(lineId: string, groupIndex: number) {
    setGroups((current) =>
      current.map((ids, i) =>
        i === groupIndex
          ? (ids.includes(lineId) ? ids.filter((id) => id !== lineId) : [...ids, lineId])
          : ids.filter((id) => id !== lineId),
      ),
    );
  }

  async function apply() {
    if (!bill.bill) return;
    setBusy(true);
    try {
      if (mode === 'none') await api.splitBill(bill.bill.id, { mode: 'none' });
      else if (mode === 'even') await api.splitBill(bill.bill.id, { mode: 'even', ways });
      else if (mode === 'by_person') await api.splitBill(bill.bill.id, { mode: 'by_person' });
      else {
        const payload = groups
          .map((ids, i) => ({ label: t('billing.split.share', { n: i + 1 }), itemIds: ids }))
          .filter((g) => g.itemIds.length > 0);
        if (!payload.length) {
          toast({ tone: 'warn', title: t('billing.split.unassigned'), icon: 'alert' });
          setBusy(false);
          return;
        }
        await api.splitBill(bill.bill.id, { mode: 'by_item', groups: payload });
      }
      toast({ tone: 'success', title: t('billing.split.applied'), icon: 'check' });
      onApplied();
    } catch {
      toast({ tone: 'error', title: t('common.somethingWrong'), icon: 'alert' });
    } finally {
      setBusy(false);
    }
  }

  const perShare = Math.floor(bill.totals.total_cents / Math.max(1, ways));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('billing.split.title')}
      side
      maxWidth="max-w-lg"
      footer={
        <Button variant="primary" size="lg" block loading={busy} onClick={apply} icon="check">
          {t('common.apply')}
        </Button>
      }
    >
      <div className="pb-2">
        <div className="grid gap-2">
          {(['even', 'by_person', 'by_item', 'none'] as SplitMode[]).map((option) => (
            <button
              key={option}
              onClick={() => setMode(option)}
              className={cn(
                'flex items-start gap-3 rounded-2xl p-3.5 text-left transition',
                mode === option
                  ? 'bg-azul-600 text-white shadow-plate'
                  : 'bg-white text-cal-700 hairline hover:bg-cal-50',
              )}
            >
              <Icon name="split" className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {t(`billing.split.${option === 'by_person' ? 'byPerson' : option === 'by_item' ? 'byItem' : option}` as never)}
                </p>
                <p className={cn('text-sm', mode === option ? 'text-azul-100' : 'text-cal-500')}>
                  {option === 'none'
                    ? ''
                    : t(`billing.split.${option === 'by_person' ? 'byPersonHint' : option === 'by_item' ? 'byItemHint' : 'evenHint'}` as never)}
                </p>
              </div>
              {mode === option && <Icon name="check" className="size-5 shrink-0" strokeWidth={2.4} />}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {mode === 'even' && (
            <motion.div
              key="even"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5"
            >
              <p className="mb-2.5 text-sm font-semibold text-cal-800">
                {t('billing.split.ways')}
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                  <button
                    key={n}
                    onClick={() => setWays(n)}
                    className={cn(
                      'size-12 rounded-xl text-base font-semibold tnum transition',
                      ways === n
                        ? 'bg-barro-500 text-white shadow-plate'
                        : 'bg-cal-100 text-cal-700 hover:bg-cal-200',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-4 rounded-2xl bg-cal-100 p-3.5 text-center">
                <span className="text-sm text-cal-600">{ways} × </span>
                <span className="text-xl font-semibold text-cal-900 tnum">
                  {euro(perShare, locale)}
                </span>
              </p>
            </motion.div>
          )}

          {mode === 'by_item' && (
            <motion.div
              key="by_item"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-cal-800">{t('billing.split.assign')}</p>
                <Button
                  size="sm"
                  variant="quiet"
                  icon="plus"
                  onClick={() => setGroups((g) => [...g, []])}
                >
                  {t('billing.split.share', { n: groups.length + 1 })}
                </Button>
              </div>

              <ul className="space-y-2">
                {bill.lines.map((line) => {
                  const assigned = assignment.get(line.id);
                  return (
                    <li key={line.id} className="rounded-2xl bg-white p-3 hairline">
                      <div className="flex items-center gap-2">
                        <span className="w-7 text-sm font-semibold text-cal-500 tnum">
                          {line.qty}×
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-cal-800">
                          {line.name_snapshot}
                        </span>
                        <span className="text-sm font-medium text-cal-900 tnum">
                          {euro(line.unit_price_cents * line.qty, locale)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {groups.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => assign(line.id, index)}
                            className={cn(
                              'rounded-lg px-2.5 py-1 text-xs font-medium transition',
                              assigned === index
                                ? 'bg-azul-600 text-white'
                                : 'bg-cal-100 text-cal-600 hover:bg-cal-200',
                            )}
                          >
                            {t('billing.split.share', { n: index + 1 })}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------

function PaymentSheet({
  open, onClose, bill, onIssued,
}: {
  open: boolean;
  onClose: () => void;
  bill: BillView;
  onIssued: (receipt: ReceiptData) => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [method, setMethod] = useState<PaymentMethod>('multibanco');
  const [nif, setNif] = useState('');
  const [wantsNif, setWantsNif] = useState(false);
  const [busy, setBusy] = useState(false);

  const nifOk = !wantsNif || isValidNif(nif);

  async function finalize() {
    if (!bill.bill || !nifOk) return;
    setBusy(true);
    try {
      const { receipt } = await api.finalizeBill(bill.bill.id, {
        paymentMethod: method,
        nif: wantsNif ? nif : null,
      });
      onIssued(receipt);
    } catch (err: any) {
      toast({
        tone: 'error',
        title: t('common.somethingWrong'),
        body: err?.code,
        icon: 'alert',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('billing.payment')}
      maxWidth="max-w-md"
      footer={
        <Button
          variant="primary"
          size="xl"
          block
          loading={busy}
          disabled={!nifOk}
          onClick={finalize}
          icon="printer"
        >
          {busy ? t('billing.finalizing') : t('billing.issue')}
          <span className="ml-auto tnum">{euro(bill.totals.total_cents, locale)}</span>
        </Button>
      }
    >
      <div className="pb-2">
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((option) => (
            <button
              key={option.code}
              onClick={() => setMethod(option.code)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl p-4 transition',
                method === option.code
                  ? 'bg-azul-600 text-white shadow-plate'
                  : 'bg-white text-cal-700 hairline hover:bg-cal-50',
              )}
            >
              <Icon name={option.icon} className="size-7" strokeWidth={1.6} />
              <span className="text-sm font-medium">
                {t(`billing.method.${option.code}` as never)}
              </span>
            </button>
          ))}
        </div>

        {/* NIF is optional by law for a simplified invoice, so the default
            is "no NIF" and asking for one is the deliberate action. */}
        <div className="mt-5 rounded-2xl bg-white p-4 hairline">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={wantsNif}
              onChange={(e) => setWantsNif(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 rounded accent-azul-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-cal-900">{t('billing.nif')}</span>
              <span className="block text-xs text-cal-500">
                {t('billing.finalConsumerHint')}
              </span>
            </span>
          </label>

          <AnimatePresence>
            {wantsNif && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <input
                  value={nif}
                  onChange={(e) => setNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder={t('billing.nifPlaceholder')}
                  inputMode="numeric"
                  className={cn(
                    'mt-3 h-12 w-full rounded-xl bg-cal-50 px-3.5 text-lg tnum hairline',
                    nif.length === 9 && !isValidNif(nif) && 'ring-2 ring-barro-400',
                  )}
                />
                {nif.length === 9 && !isValidNif(nif) && (
                  <p className="mt-1.5 text-xs font-medium text-barro-600">
                    {t('billing.nifInvalid')}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!wantsNif && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cal-100 px-2.5 py-1.5 text-xs font-medium text-cal-600">
              <Icon name="users" className="size-3.5" />
              {t('billing.finalConsumer')}
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------

function ReceiptModal({
  receipt, onClose,
}: {
  receipt: ReceiptData | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <Modal
      open={!!receipt}
      onClose={onClose}
      maxWidth="max-w-sm"
      footer={
        <div className="flex gap-2">
          <Button variant="quiet" size="lg" className="flex-1" icon="printer" onClick={() => window.print()}>
            {t('common.print')}
          </Button>
          <Button variant="primary" size="lg" className="flex-1" onClick={onClose}>
            {t('billing.receipt.newTable')}
          </Button>
        </div>
      }
    >
      {receipt && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="rounded-2xl bg-white p-5 shadow-plate"
        >
          {/* A demo build must never look like a real fiscal document. */}
          {!receipt.certified && (
            <div className="mb-4 rounded-xl border-2 border-dashed border-barro-300 bg-barro-50 p-3">
              <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-barro-700 uppercase">
                <Icon name="alert" className="size-4" />
                {t('billing.receipt.notFiscal')}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-barro-600">
                {t('billing.receipt.notFiscalBody')}
              </p>
            </div>
          )}

          <div className="text-center">
            <p className="display text-lg font-semibold text-cal-900">{t('appName')}</p>
            <p className="text-xs text-cal-500">{t('billing.receipt.title')}</p>
          </div>

          <div className="my-4 border-y border-dashed border-cal-300 py-3 text-xs text-cal-600">
            <div className="flex justify-between">
              <span>{t('common.table')}</span>
              <span className="font-medium tnum">{receipt.tableNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('common.guests')}</span>
              <span className="font-medium tnum">{receipt.guestCount}</span>
            </div>
            <div className="flex justify-between">
              <span>NIF</span>
              <span className="font-medium tnum">
                {receipt.nif ?? t('billing.finalConsumer')}
              </span>
            </div>
          </div>

          <ul className="space-y-1 text-xs">
            {receipt.lines.map((line) => (
              <li key={line.id} className="flex gap-2">
                <span className="w-6 shrink-0 tnum">{line.qty}×</span>
                <span className="min-w-0 flex-1 truncate">{line.name_snapshot}</span>
                <span className="shrink-0 tnum">
                  {euro(line.unit_price_cents * line.qty, locale)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-1 border-t border-dashed border-cal-300 pt-3 text-xs">
            <div className="flex justify-between text-cal-600">
              <dt>{t('common.subtotal')}</dt>
              <dd className="tnum">{euro(receipt.totals.subtotal_cents, locale)}</dd>
            </div>
            {receipt.totals.vat_13_cents > 0 && (
              <div className="flex justify-between text-cal-600">
                <dt>{t('common.ivaAt', { rate: 13 })}</dt>
                <dd className="tnum">{euro(receipt.totals.vat_13_cents, locale)}</dd>
              </div>
            )}
            {receipt.totals.vat_23_cents > 0 && (
              <div className="flex justify-between text-cal-600">
                <dt>{t('common.ivaAt', { rate: 23 })}</dt>
                <dd className="tnum">{euro(receipt.totals.vat_23_cents, locale)}</dd>
              </div>
            )}
            <div className="flex justify-between pt-1 text-sm font-bold text-cal-900">
              <dt>{t('common.toPay')}</dt>
              <dd className="tnum">{euro(receipt.totals.payable_cents, locale)}</dd>
            </div>
            <div className="flex justify-between text-cal-600">
              <dt>{t('billing.payment')}</dt>
              <dd>{t(`billing.method.${receipt.paymentMethod}` as never)}</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-dashed border-cal-300 pt-3 text-center text-[10px] text-cal-500">
            <p className="tnum">
              {t('billing.receipt.invoiceNo')}: {receipt.invoiceNo}
            </p>
            <p className="tnum">ATCUD: {receipt.atcud}</p>
            <p className="tnum">
              {t('billing.receipt.issued')}: {clock(receipt.issuedAt, locale)}
            </p>
            <p className="mt-2 break-all font-mono text-[9px] text-cal-400">
              {receipt.qrPayload}
            </p>
          </div>
        </motion.div>
      )}
    </Modal>
  );
}
