import { useState } from 'react';
import { motion } from 'framer-motion';
import { api, type CallReason } from '../../lib/api';
import { clock } from '../../lib/format';
import { Icon, type IconName } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { Sheet, SPRING, cn, useToast } from '../../ui';

const REASONS: Array<{ code: CallReason; icon: IconName }> = [
  { code: 'help', icon: 'bell' },
  { code: 'water', icon: 'WATER' as IconName },
  { code: 'bill', icon: 'receipt' },
  { code: 'cutlery', icon: 'UTENSILS' },
  { code: 'cleaning', icon: 'broom' },
];

/**
 * The waiter-call button. Deliberately a short list of concrete reasons
 * rather than a free-text box: the waiter can then arrive already
 * carrying the water, or the card machine.
 */
export function WaiterCallSheet({
  open, onClose, tableNumber, pending, onCalled,
}: {
  open: boolean;
  onClose: () => void;
  tableNumber: number;
  pending: { id: string; reason: CallReason; created_at: string } | null;
  onCalled: () => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState<CallReason | null>(null);

  async function call(reason: CallReason) {
    setBusy(reason);
    try {
      await api.callWaiter(tableNumber, reason);
      toast({
        tone: 'success',
        title: t('call.sent'),
        body: t('call.sentBody', { n: tableNumber }),
        icon: 'bell',
      });
      onCalled();
      onClose();
    } catch {
      toast({ tone: 'error', title: t('common.somethingWrong'), icon: 'alert' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('call.title')} maxWidth="max-w-md">
      <div className="pb-4">
        {pending && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-3 rounded-2xl bg-barro-50 p-3.5 text-sm text-barro-800"
          >
            <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-barro-500 text-white">
              <Icon name="bell" className="size-4.5" />
              <span className="anim-ring absolute inset-0 rounded-full" />
            </span>
            <div>
              <p className="font-semibold">{t('call.pending')}</p>
              <p className="text-xs">
                {t('call.reason.' + pending.reason as never)} ·{' '}
                {t('common.at', { t: clock(pending.created_at, locale) })}
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid gap-2">
          {REASONS.map((reason, i) => (
            <motion.button
              key={reason.code}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: i * 0.045 }}
              whileTap={{ scale: 0.98 }}
              disabled={busy !== null}
              onClick={() => call(reason.code)}
              className={cn(
                'flex items-center gap-3.5 rounded-2xl bg-white p-4 text-left shadow-plate hairline transition',
                'hover:bg-azul-50 disabled:opacity-60',
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-azul-50 text-azul-600">
                {busy === reason.code ? (
                  <span className="anim-spin size-5 rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Icon name={reason.icon} className="size-5" />
                )}
              </span>
              <span className="flex-1 font-medium text-cal-800">
                {t(`call.reason.${reason.code}` as never)}
              </span>
              <Icon name="chevron-right" className="size-5 text-cal-300" />
            </motion.button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
