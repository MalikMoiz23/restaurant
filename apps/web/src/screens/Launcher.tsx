import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n, LOCALES } from '../i18n';
import { Icon, type IconName } from '../lib/Icon';
import { Button, cn, SPRING } from '../ui';
import { useConnection } from '../lib/live';
import { ConnectionPill } from '../ui';

/**
 * Device picker. In a real install each tablet is locked to one of these
 * roles; here they all live behind one entry screen so the whole system
 * can be walked through on a single device.
 */
export function Launcher() {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const connection = useConnection();
  const [table, setTable] = useState(7);

  const roles: Array<{
    key: 'customer' | 'kitchen' | 'counter';
    icon: IconName;
    to: string;
    accent: string;
    ring: string;
  }> = [
    { key: 'customer', icon: 'tablet', to: `/mesa/${table}`, accent: 'from-azul-500 to-azul-700', ring: 'group-hover:ring-azul-300' },
    { key: 'kitchen', icon: 'kitchen', to: '/cozinha', accent: 'from-cal-700 to-azul-900', ring: 'group-hover:ring-cal-400' },
    { key: 'counter', icon: 'counter', to: '/balcao', accent: 'from-barro-400 to-barro-600', ring: 'group-hover:ring-barro-300' },
  ];

  return (
    <div className="min-h-dvh bg-cal-50">
      {/* Azulejo band: the one place the tile motif is shown at full
          strength, so it reads as an identity rather than wallpaper. */}
      <div className="relative overflow-hidden bg-azul-600 text-white">
        <div className="azulejo-soft absolute inset-0 opacity-[0.13]" />
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-azul-400/25 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-6 pt-10 pb-14 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                <Icon name="UTENSILS" className="size-6" strokeWidth={1.8} />
              </div>
              <div>
                <p className="display text-2xl leading-none font-semibold">{t('appName')}</p>
                <p className="text-xs text-azul-200">Portugal · pt-PT</p>
              </div>
            </div>
            <ConnectionPill state={connection} labels={{
              online: t('net.online'), connecting: t('net.connecting'), offline: t('net.offline'),
            }} dark />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.05 }}
            className="display mt-8 max-w-2xl text-3xl leading-tight font-semibold sm:text-4xl"
          >
            {t('tagline')}
          </motion.h1>

          <div className="mt-5 flex flex-wrap gap-2">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLocale(l.code)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition',
                  locale === l.code
                    ? 'bg-white text-azul-700 font-medium'
                    : 'bg-white/10 text-azul-100 hover:bg-white/20',
                )}
              >
                <span aria-hidden>{l.flag}</span>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-16 sm:px-8">
        <div className="-mt-8 grid gap-4 sm:grid-cols-3">
          {roles.map((role, i) => (
            <motion.button
              key={role.key}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.08 + i * 0.07 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => navigate(role.to)}
              className="group rounded-plate bg-white p-5 text-left shadow-plate ring-2 ring-transparent transition-shadow hover:shadow-lift"
            >
              <div
                className={cn(
                  'mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-br text-white',
                  role.accent,
                )}
              >
                <Icon name={role.icon} className="size-6" strokeWidth={1.8} />
              </div>
              <p className="text-base font-semibold text-cal-900">{t(`role.${role.key}` as never)}</p>
              <p className="mt-1 text-sm leading-relaxed text-cal-500">
                {t(`role.${role.key}Desc` as never)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-azul-600">
                {t('common.open')}
                <Icon name="arrow-right" className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </motion.button>
          ))}
        </div>

        {/* Which table the demo tablet believes it is bolted to. */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-plate hairline">
          <Icon name="tablet" className="size-5 text-cal-400" />
          <span className="text-sm text-cal-600">{t('role.demoTable')}</span>
          <div className="flex flex-wrap gap-1.5">
            {[1, 5, 7, 12, 15, 19, 25].map((n) => (
              <button
                key={n}
                onClick={() => setTable(n)}
                className={cn(
                  'size-9 rounded-xl text-sm font-semibold tnum transition',
                  table === n
                    ? 'bg-azul-600 text-white shadow-plate'
                    : 'bg-cal-100 text-cal-600 hover:bg-cal-200',
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="primary"
            iconRight="arrow-right"
            className="ml-auto"
            onClick={() => navigate(`/mesa/${table}`)}
          >
            {t('common.tableN', { n: table })}
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-cal-400">{t('role.pickHint')}</p>
      </div>
    </div>
  );
}
