import { motion } from 'framer-motion';
import type { SessionDetail, OrderStatus } from '../../lib/api';
import { clock, euro } from '../../lib/format';
import { DishArt } from '../../lib/DishArt';
import { Icon } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { Button, EmptyState, SPRING, cn } from '../../ui';

const FLOW: OrderStatus[] = ['received', 'preparing', 'ready', 'served'];

/**
 * Live progress of everything this table has sent to the kitchen.
 * The timeline is the point: a guest who can see "being prepared" does
 * not flag down a waiter to ask where their food is.
 */
export function OrdersView({
  detail,
  onBrowse,
}: {
  detail: SessionDetail;
  onBrowse: () => void;
}) {
  const { t, locale } = useI18n();

  if (!detail.orders.length) {
    return (
      <EmptyState
        icon="clock"
        title={t('orders.none')}
        body={t('cart.emptyHint')}
        action={<Button variant="primary" onClick={onBrowse}>{t('menu.title')}</Button>}
      />
    );
  }

  return (
    <div className="space-y-4 pt-5">
      {detail.orders.map((order, index) => {
        const stageIndex = FLOW.indexOf(order.status);
        const cancelled = order.status === 'cancelled';
        const orderTotal = order.items.reduce((s, i) => s + i.unitPriceCents * i.qty, 0);

        return (
          <motion.article
            key={order.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: index * 0.06 }}
            className="overflow-hidden rounded-plate bg-white shadow-plate hairline"
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-cal-100 px-4 py-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-azul-50 text-base font-semibold text-azul-700 tnum">
                {order.seq}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-cal-900">
                  {t('orders.orderN', { n: order.seq })}
                </p>
                <p className="text-xs text-cal-500">
                  {t('orders.placedAt', { t: clock(order.placed_at, locale) })}
                </p>
              </div>
              <span className="text-sm font-semibold text-cal-900 tnum">
                {euro(orderTotal, locale)}
              </span>
            </div>

            {/* Progress rail. The filled portion animates on width so the
                change reads as movement forward, not a colour swap. */}
            {!cancelled ? (
              <div className="px-4 pt-4">
                <div className="relative">
                  <div className="absolute left-0 right-0 top-3.5 h-1 rounded-full bg-cal-100" />
                  <motion.div
                    className="absolute left-0 top-3.5 h-1 rounded-full bg-azul-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(stageIndex / (FLOW.length - 1)) * 100}%` }}
                    transition={{ ...SPRING, damping: 26 }}
                  />
                  <ol className="relative flex justify-between">
                    {FLOW.map((stage, i) => {
                      const reached = i <= stageIndex;
                      const current = i === stageIndex;
                      return (
                        <li key={stage} className="flex flex-col items-center gap-1.5">
                          <span
                            className={cn(
                              'grid size-8 place-items-center rounded-full border-2 bg-white transition-colors',
                              reached
                                ? 'border-azul-500 text-azul-600'
                                : 'border-cal-200 text-cal-300',
                              current && 'ring-4 ring-azul-500/15',
                            )}
                          >
                            {i < stageIndex ? (
                              <Icon name="check" className="size-4" strokeWidth={2.6} />
                            ) : (
                              <span
                                className={cn(
                                  'size-2 rounded-full',
                                  reached ? 'bg-azul-500' : 'bg-cal-300',
                                  current && 'anim-beat',
                                )}
                              />
                            )}
                          </span>
                          <span
                            className={cn(
                              'max-w-22 text-center text-[11px] leading-tight',
                              current ? 'font-semibold text-azul-700' : 'text-cal-400',
                            )}
                          >
                            {t(`orders.status.${stage}` as never)}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                <p className="mt-3 text-center text-sm text-cal-600">
                  {t(`orders.statusHint.${order.status}` as never)}
                </p>
              </div>
            ) : (
              <div className="px-4 pt-4">
                <p className="rounded-xl bg-cal-100 p-3 text-center text-sm text-cal-600">
                  {t('orders.statusHint.cancelled')}
                </p>
              </div>
            )}

            <ul className="divide-y divide-cal-100 px-4 py-3">
              {order.items.map((line) => (
                <li key={line.id} className="flex items-center gap-3 py-2.5">
                  <div className="size-11 shrink-0 overflow-hidden rounded-lg">
                    <DishArt glyph={line.glyph} seed={line.name} className="size-full object-cover" />
                  </div>
                  <span className="w-7 shrink-0 text-sm font-semibold text-cal-500 tnum">
                    {line.qty}×
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-cal-800">{line.name}</p>
                    {line.note && (
                      <p className="truncate text-xs text-cal-500">{line.note}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm text-cal-600 tnum">
                    {euro(line.unitPriceCents * line.qty, locale)}
                  </span>
                </li>
              ))}
            </ul>

            {order.note && (
              <p className="mx-4 mb-4 flex items-start gap-2 rounded-xl bg-cal-100 p-3 text-sm text-cal-600">
                <Icon name="info" className="mt-0.5 size-4 shrink-0" />
                {order.note}
              </p>
            )}
          </motion.article>
        );
      })}

      <Button variant="secondary" block size="lg" onClick={onBrowse} icon="plus">
        {t('cart.addMore')}
      </Button>
    </div>
  );
}
