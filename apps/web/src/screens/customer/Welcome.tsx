import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { useI18n, LOCALES } from '../../i18n';
import { Icon } from '../../lib/Icon';
import { Button, SPRING, cn, useToast } from '../../ui';

/**
 * First screen a guest sees. Three decisions, no typing: language, how
 * many people, go. Everything else is inferred from the table.
 */
export function Welcome({
  tableNumber,
  onOpened,
}: {
  tableNumber: number;
  onOpened: () => void;
}) {
  const { t, locale, setLocale } = useI18n();
  const toast = useToast();
  const [guests, setGuests] = useState(2);
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      await api.openSession(tableNumber, guests, locale);
      onOpened();
    } catch {
      toast({ tone: 'error', title: t('common.somethingWrong'), icon: 'alert' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-azul-600 text-white">
      <div className="azulejo-soft absolute inset-0 opacity-[0.12]" />
      <motion.div
        aria-hidden
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        className="absolute -left-32 -top-32 size-96 rounded-full bg-azul-400/25 blur-3xl"
      />
      <motion.div
        aria-hidden
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.3, ease: 'easeOut', delay: 0.15 }}
        className="absolute -bottom-40 -right-24 size-[26rem] rounded-full bg-barro-400/20 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
        >
          <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-sm backdrop-blur">
            <Icon name="tablet" className="size-4" />
            {t('welcome.atTable', { n: tableNumber })}
          </div>

          <h1 className="display text-4xl leading-tight font-semibold sm:text-5xl">
            {t('welcome.greeting')}
          </h1>
          <p className="mt-3 text-azul-100">{t('welcome.noLogin')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.08 }}
          className="mt-9"
        >
          <p className="mb-2.5 text-sm font-medium text-azul-100">{t('welcome.language')}</p>
          <div className="grid grid-cols-2 gap-2">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLocale(l.code)}
                className={cn(
                  'flex items-center gap-2.5 rounded-2xl px-4 py-3.5 text-left transition',
                  locale === l.code
                    ? 'bg-white text-azul-800 shadow-lift'
                    : 'bg-white/10 text-white hover:bg-white/18',
                )}
              >
                <span className="text-xl" aria-hidden>{l.flag}</span>
                <span className="text-sm font-medium">{l.label}</span>
                {locale === l.code && <Icon name="check" className="ml-auto size-4" strokeWidth={2.4} />}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.14 }}
          className="mt-7"
        >
          <p className="mb-2.5 text-sm font-medium text-azul-100">{t('welcome.howMany')}</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <button
                key={n}
                onClick={() => setGuests(n)}
                className={cn(
                  'size-14 rounded-2xl text-lg font-semibold tnum transition',
                  guests === n
                    ? 'bg-barro-500 text-white shadow-lift'
                    : 'bg-white/10 text-white hover:bg-white/18',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.2 }}
          className="mt-9"
        >
          <Button
            size="xl"
            block
            loading={busy}
            onClick={open}
            className="bg-white text-azul-700 shadow-lift hover:bg-cal-50"
            iconRight="arrow-right"
          >
            {t('welcome.start')}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
