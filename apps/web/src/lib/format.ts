/**
 * Portuguese formatting. Everything a guest or cashier reads goes
 * through here so no screen ever shows an American date or a dot
 * decimal separator.
 */

export type Locale = 'pt' | 'en' | 'es' | 'fr';

/** BCP-47 tags. pt-PT matters: pt-BR formats currency differently. */
const INTL: Record<Locale, string> = {
  pt: 'pt-PT',
  en: 'en-IE', // Irish English: euro, day-first dates, metric
  es: 'es-ES',
  fr: 'fr-FR',
};

const euroCache = new Map<string, Intl.NumberFormat>();

function euroFormatter(locale: Locale) {
  const tag = INTL[locale];
  let f = euroCache.get(tag);
  if (!f) {
    f = new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    euroCache.set(tag, f);
  }
  return f;
}

/** Integer cents to "12,50 €". Cents are the only money type we carry. */
export function euro(cents: number | null | undefined, locale: Locale = 'pt'): string {
  return euroFormatter(locale).format((cents ?? 0) / 100);
}

/** Bare number, no symbol — for column headers that carry the € once. */
export function euroPlain(cents: number | null | undefined, locale: Locale = 'pt'): string {
  return new Intl.NumberFormat(INTL[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((cents ?? 0) / 100);
}

/** Rounded euros for dense dashboards: "1,2 k€" / "840 €". */
export function euroCompact(cents: number, locale: Locale = 'pt'): string {
  const value = cents / 100;
  if (value >= 1000) {
    return `${new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 1 }).format(value / 1000)} k€`;
  }
  return `${new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 0 }).format(value)} €`;
}

/** 24-hour clock, as used everywhere in Portugal. */
export function clock(value: string | Date | null | undefined, locale: Locale = 'pt'): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(INTL[locale], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

/** DD/MM/YYYY. */
export function dateShort(value: string | Date, locale: Locale = 'pt'): string {
  return new Intl.DateTimeFormat(INTL[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

/** "quinta, 11 de setembro" — used as a calendar caption. */
export function dateLong(value: string | Date, locale: Locale = 'pt'): string {
  return new Intl.DateTimeFormat(INTL[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(value));
}

export function monthLabel(value: Date, locale: Locale = 'pt'): string {
  return new Intl.DateTimeFormat(INTL[locale], { month: 'long', year: 'numeric' })
    .format(value);
}

/** Monday-first weekday initials, matching the Portuguese calendar. */
export function weekdayInitials(locale: Locale = 'pt'): string[] {
  const fmt = new Intl.DateTimeFormat(INTL[locale], { weekday: 'short' });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    return fmt.format(d).replace('.', '').slice(0, 3);
  });
}

/** Elapsed time as "4m 12s" / "1h 06m" — the kitchen's primary metric. */
export function elapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Minutes since a timestamp, for order-age colouring. */
export function minutesSince(value: string | Date): number {
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 60000);
}

/** yyyy-mm-dd in local time. Never use toISOString: it shifts to UTC. */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Monday index (0 = Monday) rather than JS's Sunday-first getDay(). */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Validates a Portuguese NIF, including the check digit. */
export function isValidNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  // Valid leading digits for the taxpayer categories in use.
  if (!'1235689'.includes(nif[0]!)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(nif[i]) * (9 - i);
  const remainder = sum % 11;
  const check = remainder < 2 ? 0 : 11 - remainder;
  return check === Number(nif[8]);
}
