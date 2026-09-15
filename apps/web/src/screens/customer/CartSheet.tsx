import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../lib/api';
import { euro, clock } from '../../lib/format';
import { DishArt } from '../../lib/DishArt';
import { Icon } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { useCart, cartTotalCents, cartCount, cartEstimateMinutes } from '../../store';
import { Button, EmptyState, Sheet, Stepper, SPRING, useToast } from '../../ui';

type Sent = { seq: number; estimatedMinutes: number; readyEstimateAt: string };

/**
 * Review and send.
 *
 * The guest has already chosen on the menu; this screen exists so they
 * can see the whole order in one place, fix a quantity, and be told how
 * long it will take before they commit to it.
 */
export function CartSheet({
  open, onClose, sessionId, onSent, onBrowse,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onSent: () => void;
  onBrowse: () => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { lines, orderNote, setQty, remove, setOrderNote, clear } = useCart();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);

  const total = cartTotalCents(lines);
  const count = cartCount(lines);
  const estimate = cartEstimateMinutes(lines);

  async function send() {
    if (!lines.length) return;
    setSending(true);
    try {
      const order = await api.placeOrder(
        sessionId,
        lines.map((l) => ({
          menuItemId: l.menuItemId, qty: l.qty, note: l.note, seatNo: l.seatNo,
        })),
        orderNote.trim(),
      );
      clear();
      // Stay on this sheet and swap to a confirmation, rather than
      // closing: the guest needs to see the order number and the time.
      setSent({
        seq: order.seq,
        estimatedMinutes: order.estimatedMinutes,
        readyEstimateAt: order.readyEstimateAt,
      });
      onSent();
    } catch (err: any) {
      toast({
        tone: 'error',
        title: t('common.somethingWrong'),
        body: err?.code === 'items_unavailable' ? t('menu.soldOut') : undefined,
        icon: 'alert',
      });
    } finally {
      setSending(false);
    }
  }

  function dismiss() {
    setSent(null);
    onClose();
  }

  // ----- confirmation -------------------------------------------------
  if (sent) {
    return (
      <Sheet open={open} onClose={dismiss} maxWidth="max-w-md">
        <div className="px-1 pb-4 pt-2 text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING}
            className="mx-auto grid size-20 place-items-center rounded-full bg-oliva-500 text-white"
          >
            <Icon name="check" className="size-10" strokeWidth={2.6} />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.1 }}
            className="display mt-5 text-2xl font-semibold text-cal-900"
          >
            {t('cart.sentTitle')}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.16 }}
            className="mt-1 text-cal-600"
          >
            {t('cart.sentNumber', { n: sent.seq })}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.22 }}
            className="mt-6 rounded-2xl bg-azul-50 p-5"
          >
            <p className="flex items-center justify-center gap-2 text-sm text-azul-700">
              <Icon name="clock" className="size-4" />
              {t('cart.estimate', { n: sent.estimatedMinutes })}
            </p>
            <p className="mt-1 text-3xl font-semibold text-azul-800 tnum">
              {clock(sent.readyEstimateAt, locale)}
            </p>
            <p className="mt-1 text-xs text-azul-600">
              {t('cart.sentReady', { t: clock(sent.readyEstimateAt, locale) })}
            </p>
          </motion.div>

          <p className="mt-3 text-xs text-cal-400">{t('orders.estimateNote')}</p>

          <div className="mt-6 grid gap-2">
            <Button
              size="xl"
              variant="primary"
              block
              icon="plus"
              onClick={() => {
                setSent(null);
                onClose();
                onBrowse();
              }}
            >
              {t('cart.addMoreNow')}
            </Button>
            <Button size="lg" variant="quiet" block icon="clock" onClick={dismiss}>
              {t('cart.trackOrder')}
            </Button>
          </div>
        </div>
      </Sheet>
    );
  }

  // ----- review -------------------------------------------------------
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('cart.review')}
      maxWidth="max-w-lg"
      footer={
        lines.length > 0 && (
          <div>
            <div className="mb-3 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-cal-600">
                  {count} {count === 1 ? t('common.item') : t('common.items')}
                </span>
                <span className="text-2xl font-semibold text-cal-900 tnum">
                  {euro(total, locale)}
                </span>
              </div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-azul-700">
                <Icon name="clock" className="size-4" />
                {t('cart.estimate', { n: estimate })}
              </p>
            </div>
            <Button
              size="xl"
              variant="primary"
              block
              loading={sending}
              onClick={send}
              icon="check"
            >
              {sending ? t('cart.sending') : t('cart.send')}
            </Button>
            <p className="mt-2.5 text-center text-xs text-cal-400">{t('cart.reorderHint')}</p>
          </div>
        )
      }
    >
      {lines.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={t('cart.empty')}
          body={t('cart.emptyHint')}
          action={<Button variant="primary" onClick={onClose}>{t('cart.addMore')}</Button>}
        />
      ) : (
        <div className="pb-2">
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {lines.map((line, index) => (
                <motion.li
                  key={`${line.menuItemId}-${line.note}-${line.seatNo}`}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -30, transition: { duration: 0.18 } }}
                  transition={SPRING}
                  className="flex gap-3 rounded-2xl bg-white p-3 shadow-plate hairline"
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl">
                    <DishArt glyph={line.glyph} seed={line.sku} className="size-full object-cover" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-cal-900">{line.name}</p>
                    <p className="text-xs text-cal-500 tnum">
                      {euro(line.unitPriceCents, locale)} {t('common.each')}
                    </p>
                    {line.note && (
                      <p className="mt-1 inline-flex items-start gap-1 rounded-lg bg-cal-100 px-2 py-1 text-xs text-cal-600">
                        <Icon name="info" className="mt-px size-3 shrink-0" />
                        {line.note}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Stepper
                        value={line.qty}
                        onChange={(q) => setQty(index, q)}
                        min={0}
                        max={20}
                        size="sm"
                      />
                      <span className="text-sm font-semibold text-cal-900 tnum">
                        {euro(line.unitPriceCents * line.qty, locale)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => remove(index)}
                    className="grid size-8 shrink-0 place-items-center self-start rounded-lg text-cal-400 transition hover:bg-barro-50 hover:text-barro-600"
                    aria-label={t('cart.remove')}
                  >
                    <Icon name="trash" className="size-4" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-cal-800">
              {t('cart.orderNote')}
            </span>
            <textarea
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder={t('cart.orderNotePlaceholder')}
              rows={2}
              maxLength={280}
              className="w-full resize-none rounded-2xl bg-white p-3.5 text-sm shadow-plate hairline placeholder:text-cal-400"
            />
          </label>

          <Button variant="ghost" block className="mt-2" onClick={onClose} icon="plus">
            {t('cart.addMore')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
