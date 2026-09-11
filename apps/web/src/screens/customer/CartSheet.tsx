import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../lib/api';
import { euro } from '../../lib/format';
import { DishArt } from '../../lib/DishArt';
import { Icon } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { useCart, cartTotalCents, cartCount } from '../../store';
import { Button, EmptyState, Sheet, Stepper, SPRING, useToast } from '../../ui';

export function CartSheet({
  open, onClose, sessionId, onSent,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onSent: () => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { lines, orderNote, setQty, remove, setOrderNote, clear } = useCart();
  const [sending, setSending] = useState(false);

  const total = cartTotalCents(lines);
  const count = cartCount(lines);

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
      toast({
        tone: 'success',
        title: t('cart.sent'),
        body: t('orders.orderN', { n: order.seq }),
        icon: 'check',
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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('cart.title')}
      maxWidth="max-w-lg"
      footer={
        lines.length > 0 && (
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-cal-600">
                {count} {count === 1 ? t('common.item') : t('common.items')}
              </span>
              <span className="text-2xl font-semibold text-cal-900 tnum">
                {euro(total, locale)}
              </span>
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
          action={<Button onClick={onClose}>{t('cart.addMore')}</Button>}
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
