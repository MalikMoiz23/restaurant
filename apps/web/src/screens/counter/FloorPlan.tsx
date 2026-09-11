import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, type FloorTable, type TableStatus } from '../../lib/api';
import { useQuery, useLiveEvents } from '../../lib/live';
import { euro, elapsed } from '../../lib/format';
import { Icon } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import {
  Button, Modal, Numpad, Skeleton, StatusDot, STATUS_COLOR, SPRING, cn, useToast,
} from '../../ui';

const STATUSES: TableStatus[] = [
  'free', 'ordering', 'eating', 'awaiting_bill', 'needs_cleaning',
];

/**
 * Live table-status dashboard. The whole room at a glance, colour-coded,
 * updating over the socket as guests order and the kitchen works.
 */
export function FloorPlan() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();

  const tables = useQuery<FloorTable[]>(() => api.tables(), []);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookup, setLookup] = useState('');
  const [openTarget, setOpenTarget] = useState<FloorTable | null>(null);
  const [guests, setGuests] = useState(2);

  const reload = tables.reload;
  useLiveEvents(
    ['table.status', 'session.opened', 'session.closed', 'order.created', 'bill.finalized', 'waiter.call', 'waiter.ack'],
    useCallback(() => reload(), [reload]),
  );

  const zones = useMemo(() => {
    const grouped = new Map<string, { name: string; tables: FloorTable[] }>();
    for (const table of tables.data ?? []) {
      const name = locale === 'pt' ? table.zone_name_pt : table.zone_name_en;
      if (!grouped.has(table.zone_code)) grouped.set(table.zone_code, { name, tables: [] });
      grouped.get(table.zone_code)!.tables.push(table);
    }
    return [...grouped.entries()].map(([code, value]) => ({ code, ...value }));
  }, [tables.data, locale]);

  const stats = useMemo(() => {
    const list = tables.data ?? [];
    const open = list.filter((table) => table.session_id);
    return {
      open: open.length,
      total: list.length,
      running: open.reduce((sum, table) => sum + table.gross_cents, 0),
      calls: list.filter((table) => table.open_call).length,
    };
  }, [tables.data]);

  async function openTable() {
    if (!openTarget) return;
    try {
      await api.openSession(openTarget.number, guests, 'pt');
      toast({ tone: 'success', title: t('common.tableN', { n: openTarget.number }), icon: 'check' });
      setOpenTarget(null);
      tables.reload();
    } catch {
      toast({ tone: 'error', title: t('common.somethingWrong'), icon: 'alert' });
    }
  }

  if (tables.loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="grid"
          label={t('counter.occupancy')}
          value={`${stats.open}/${stats.total}`}
          hint={`${Math.round((stats.open / Math.max(1, stats.total)) * 100)}%`}
        />
        <StatCard
          icon="coins"
          label={t('counter.openTables')}
          value={euro(stats.running, locale)}
          hint={`${stats.open} × ${t('common.table').toLowerCase()}`}
        />
        <StatCard
          icon="bell"
          label={t('counter.calls')}
          value={String(stats.calls)}
          tone={stats.calls > 0 ? 'alert' : undefined}
        />
        <button
          onClick={() => setLookupOpen(true)}
          className="flex items-center gap-3 rounded-plate bg-azul-600 p-4 text-left text-white shadow-plate transition hover:bg-azul-700"
        >
          <Icon name="search" className="size-6" />
          <div>
            <p className="text-sm font-semibold">{t('counter.lookup')}</p>
            <p className="text-xs text-azul-200">{t('counter.lookupHint')}</p>
          </div>
        </button>
      </div>

      {/* Legend: the same five colours used on every screen. */}
      <div className="mb-4 flex flex-wrap gap-3">
        {STATUSES.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5 text-xs text-cal-600">
            <StatusDot status={status} />
            {t(`counter.tableStatus.${status}` as never)}
          </span>
        ))}
      </div>

      <div className="space-y-6">
        {zones.map((zone) => (
          <section key={zone.code}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-cal-800">
              {zone.name}
              <span className="text-sm font-normal text-cal-400 tnum">
                {zone.tables.filter((tbl) => tbl.session_id).length}/{zone.tables.length}
              </span>
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {zone.tables.map((table, index) => (
                <TableCard
                  key={table.id}
                  table={table}
                  index={index}
                  onOpenBill={() => navigate(`/balcao/mesa/${table.number}`)}
                  onOpenTable={() => {
                    setOpenTarget(table);
                    setGuests(Math.min(table.seats, 2));
                  }}
                  onClean={async () => {
                    await api.setTableStatus(table.id, 'free');
                    tables.reload();
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <Modal
        open={lookupOpen}
        onClose={() => {
          setLookupOpen(false);
          setLookup('');
        }}
        title={t('counter.lookup')}
      >
        <div className="mb-4 grid h-16 place-items-center rounded-2xl bg-cal-100 text-3xl font-semibold text-cal-900 tnum">
          {lookup || <span className="text-cal-300">—</span>}
        </div>
        <Numpad
          onDigit={(d) => setLookup((v) => (v.length < 3 ? v + d : v))}
          onBackspace={() => setLookup((v) => v.slice(0, -1))}
          onSubmit={() => {
            if (!lookup) return;
            setLookupOpen(false);
            navigate(`/balcao/mesa/${Number(lookup)}`);
            setLookup('');
          }}
          submitDisabled={!lookup}
          submitLabel={t('common.open')}
        />
      </Modal>

      <Modal
        open={!!openTarget}
        onClose={() => setOpenTarget(null)}
        title={openTarget ? t('common.tableN', { n: openTarget.number }) : ''}
        footer={
          <Button variant="primary" size="lg" block onClick={openTable} icon="check">
            {t('counter.openTable')}
          </Button>
        }
      >
        <p className="mb-3 text-sm text-cal-600">{t('welcome.howMany')}</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: Math.max(openTarget?.seats ?? 4, 4) }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setGuests(n)}
              className={cn(
                'size-12 rounded-xl text-base font-semibold tnum transition',
                guests === n ? 'bg-azul-600 text-white shadow-plate' : 'bg-cal-100 text-cal-700 hover:bg-cal-200',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------

function StatCard({
  icon, label, value, hint, tone,
}: {
  icon: 'grid' | 'coins' | 'bell';
  label: string;
  value: string;
  hint?: string;
  tone?: 'alert';
}) {
  return (
    <div
      className={cn(
        'rounded-plate bg-white p-4 shadow-plate hairline',
        tone === 'alert' && 'ring-2 ring-barro-300',
      )}
    >
      <div className="flex items-center gap-2 text-cal-500">
        <Icon name={icon} className="size-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold text-cal-900 tnum">{value}</p>
      {hint && <p className="text-xs text-cal-400">{hint}</p>}
    </div>
  );
}

function TableCard({
  table, index, onOpenBill, onOpenTable, onClean,
}: {
  table: FloorTable;
  index: number;
  onOpenBill: () => void;
  onOpenTable: () => void;
  onClean: () => void;
}) {
  const { t, locale } = useI18n();
  const occupied = !!table.session_id;
  const color = STATUS_COLOR[table.status] ?? 'var(--color-cal-400)';

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...SPRING, delay: Math.min(index * 0.025, 0.2) }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={
        table.status === 'needs_cleaning' ? onClean : occupied ? onOpenBill : onOpenTable
      }
      className="relative overflow-hidden rounded-2xl bg-white p-3.5 text-left shadow-plate hairline transition-shadow hover:shadow-lift"
    >
      {/* Status is carried by a colour bar, not by the card background:
          the numbers must stay legible at every state. */}
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} />

      {table.open_call && (
        <span className="absolute right-2.5 top-3 grid size-6 place-items-center rounded-full bg-barro-500 text-white">
          <Icon name="bell" className="size-3.5 anim-beat" strokeWidth={2.4} />
        </span>
      )}

      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-cal-900 tnum">{table.number}</span>
        <span className="text-xs text-cal-400 tnum">
          {table.guest_count ?? table.seats} <Icon name="users" className="inline size-3" />
        </span>
      </div>

      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
        <StatusDot status={table.status} />
        {t(`counter.tableStatus.${table.status}` as never)}
      </p>

      {occupied ? (
        <div className="mt-2.5 border-t border-cal-100 pt-2.5">
          <p className="text-base font-semibold text-cal-900 tnum">
            {euro(table.gross_cents, locale)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-cal-400">
            <Icon name="clock" className="size-3" />
            {table.opened_at ? elapsed((Date.now() - new Date(table.opened_at).getTime()) / 1000) : '—'}
            {table.active_orders > 0 && (
              <span className="ml-auto rounded bg-azul-50 px-1.5 font-semibold text-azul-600 tnum">
                {table.active_orders}
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="mt-2.5 border-t border-cal-100 pt-2.5 text-[11px] text-cal-400">
          {table.status === 'needs_cleaning' ? t('counter.markClean') : t('counter.openTable')}
        </p>
      )}
    </motion.button>
  );
}
