import { motion } from 'framer-motion';
import { Icon, type IconName } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { Button, Sheet, SPRING } from '../../ui';

const STORAGE_KEY = 'mesa.seenHelp';

/** True the first time this device shows a guest the menu. */
export function shouldShowHelp(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    // Private browsing: showing the guide again is harmless, hiding a
    // guest's only instructions is not.
    return true;
  }
}

export function markHelpSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

/**
 * Four steps, shown once. Most guests will never read it, but the ones
 * who have never used a table tablet need something that answers "what
 * do I do" without asking a waiter.
 */
export function HowItWorks({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();

  const steps: Array<{ icon: IconName; title: string; body: string }> = [
    { icon: 'plus', title: t('help.step1'), body: t('help.step1body') },
    { icon: 'receipt', title: t('help.step2'), body: t('help.step2body') },
    { icon: 'kitchen', title: t('help.step3'), body: t('help.step3body') },
    { icon: 'coins', title: t('help.step4'), body: t('help.step4body') },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <Button size="xl" variant="primary" block onClick={onClose} icon="check">
          {t('help.gotIt')}
        </Button>
      }
    >
      <div className="pb-2">
        <h2 className="display mb-1 text-2xl font-semibold text-cal-900">
          {t('help.title')}
        </h2>
        <p className="mb-6 text-sm text-cal-500">{t('welcome.noLogin')}</p>

        <ol className="space-y-3">
          {steps.map((step, index) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING, delay: 0.06 + index * 0.08 }}
              className="flex gap-3.5 rounded-2xl bg-white p-4 shadow-plate hairline"
            >
              <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-azul-600 text-white">
                <Icon name={step.icon} className="size-5" strokeWidth={1.9} />
                <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-barro-500 text-[11px] font-bold text-white tnum">
                  {index + 1}
                </span>
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-cal-900">{step.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-cal-500">{step.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </Sheet>
  );
}
