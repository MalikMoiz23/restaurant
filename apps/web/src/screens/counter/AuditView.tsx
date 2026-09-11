import { motion } from 'framer-motion';
import { api, type AuditEntry } from '../../lib/api';
import { useQuery } from '../../lib/live';
import { clock, dateShort } from '../../lib/format';
import { Icon, type IconName } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { EmptyState, Skeleton, SPRING, cn } from '../../ui';

const ENTITY_ICON: Record<string, IconName> = {
  order: 'clock',
  order_item: 'UTENSILS',
  bill: 'receipt',
  bill_split: 'split',
  session: 'users',
  table: 'grid',
  waiter_call: 'bell',
  menu_item: 'UTENSILS',
  auth: 'lock',
  closeout: 'coins',
};

/**
 * Audit trail. Every order and bill mutation, with who did it and when.
 * Required by the security brief, and the first thing anyone reaches for
 * when a till does not balance.
 */
export function AuditView() {
  const { t, locale } = useI18n();
  const log = useQuery<AuditEntry[]>(() => api.auditTrail(80), [], { pollMs: 20_000 });

  if (log.loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  const entries = log.data ?? [];

  return (
    <div>
      <div className="mb-5">
        <h1 className="display text-2xl font-semibold text-cal-900">{t('audit.title')}</h1>
        <p className="text-sm text-cal-500">{t('audit.subtitle')}</p>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon="shield" title={t('common.empty')} />
      ) : (
        <ol className="overflow-hidden rounded-plate bg-white shadow-plate hairline">
          {entries.map((entry, index) => {
            const destructive = /void|cancel|reject|throttl/.test(entry.action);
            const money = entry.entity === 'bill' || entry.entity === 'closeout';
            return (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: Math.min(index * 0.015, 0.3) }}
                className="flex items-start gap-3 border-b border-cal-100 px-4 py-3 last:border-0"
              >
                <span
                  className={cn(
                    'mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl',
                    destructive
                      ? 'bg-barro-50 text-barro-600'
                      : money
                        ? 'bg-oliva-300/25 text-oliva-600'
                        : 'bg-cal-100 text-cal-500',
                  )}
                >
                  <Icon name={ENTITY_ICON[entry.entity] ?? 'info'} className="size-4.5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-cal-900">
                    <span className="font-mono text-[13px] text-cal-600">{entry.entity}</span>
                    {' · '}
                    <span className={destructive ? 'text-barro-600' : 'text-azul-700'}>
                      {entry.action}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-cal-500">
                    {entry.staff_name ?? t('audit.system')}
                    {entry.ip && ` · ${entry.ip}`}
                  </p>
                  {Object.keys(entry.detail ?? {}).length > 0 && (
                    <p className="mt-1 truncate font-mono text-[11px] text-cal-400">
                      {Object.entries(entry.detail)
                        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                        .join('  ')}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium text-cal-700 tnum">
                    {clock(entry.at, locale)}
                  </p>
                  <p className="text-[11px] text-cal-400 tnum">{dateShort(entry.at, locale)}</p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
