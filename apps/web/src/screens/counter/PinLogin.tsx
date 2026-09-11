import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api, type Staff } from '../../lib/api';
import { useQuery } from '../../lib/live';
import { Icon } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { useAuth } from '../../store';
import { Numpad, SPRING, cn } from '../../ui';

/**
 * Staff sign-in. A numeric PIN on a large pad, because this is done
 * dozens of times a shift on a touchscreen with wet hands.
 */
export function PinLogin() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const signIn = useAuth((s) => s.signIn);
  const signingIn = useAuth((s) => s.signingIn);
  const error = useAuth((s) => s.error);
  const retryAfter = useAuth((s) => s.retryAfter);

  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(0);
  const roster = useQuery<Staff[]>(() => api.staff(), []);

  // Four digits is the whole PIN, so submit as soon as it is complete
  // rather than making someone reach for a confirm key.
  useEffect(() => {
    if (pin.length !== 4 || signingIn) return;
    void (async () => {
      const ok = await signIn(pin);
      if (!ok) {
        setShake((n) => n + 1);
        setPin('');
      }
    })();
  }, [pin, signingIn, signIn]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-azul-700">
      <div className="azulejo-soft absolute inset-0 opacity-[0.1]" />
      <div className="absolute -left-40 top-1/3 size-96 rounded-full bg-azul-500/30 blur-3xl" />
      <div className="absolute -right-32 -bottom-32 size-96 rounded-full bg-barro-500/20 blur-3xl" />

      <button
        onClick={() => navigate('/')}
        className="absolute left-4 top-4 z-10 grid size-10 place-items-center rounded-xl bg-white/12 text-white backdrop-blur transition hover:bg-white/20"
        aria-label={t('common.back')}
      >
        <Icon name="chevron-left" className="size-5" />
      </button>

      <div className="relative mx-auto grid min-h-dvh max-w-5xl items-center gap-8 px-6 py-12 lg:grid-cols-[1fr_auto]">
        <div className="text-white">
          <div className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-white/12 backdrop-blur">
            <Icon name="lock" className="size-7" strokeWidth={1.8} />
          </div>
          <h1 className="display text-4xl leading-tight font-semibold">{t('auth.title')}</h1>
          <p className="mt-2 text-azul-200">{t('auth.subtitle')}</p>

          {roster.data && roster.data.length > 0 && (
            <div className="mt-8">
              <ul className="flex flex-wrap gap-2">
                {roster.data.map((member) => (
                  <li
                    key={member.id}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm backdrop-blur"
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-white/20 text-[11px] font-bold">
                      {member.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                    </span>
                    <span>{member.name}</span>
                    <span className="text-azul-300">
                      {t(`auth.roles.${member.role}` as never)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 flex items-start gap-2 rounded-2xl bg-amber-400/15 p-3 text-sm text-amber-100">
                <Icon name="info" className="mt-0.5 size-4 shrink-0" />
                {t('auth.demoHint')}
              </p>
            </div>
          )}
        </div>

        <motion.div
          key={shake}
          animate={shake ? { x: [0, -11, 11, -7, 7, 0] } : undefined}
          transition={{ duration: 0.42 }}
          className="mx-auto w-full max-w-xs"
        >
          <div className="rounded-3xl bg-cal-50 p-5 shadow-lift">
            <div className="mb-5 flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  animate={{
                    scale: pin.length === i + 1 ? [1, 1.28, 1] : 1,
                    backgroundColor: i < pin.length ? 'var(--color-azul-600)' : 'var(--color-cal-200)',
                  }}
                  transition={SPRING}
                  className="size-4 rounded-full"
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  key={error + retryAfter}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    'mb-4 rounded-xl px-3 py-2 text-center text-sm font-medium',
                    'bg-barro-50 text-barro-700',
                  )}
                >
                  {error === 'too_many_attempts'
                    ? t('auth.throttled', { n: retryAfter })
                    : t('auth.invalid')}
                </motion.p>
              )}
            </AnimatePresence>

            <Numpad
              onDigit={(d) => setPin((p) => (p.length < 4 ? p + d : p))}
              onBackspace={() => setPin((p) => p.slice(0, -1))}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
