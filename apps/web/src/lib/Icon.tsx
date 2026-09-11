import type { ReactElement } from 'react';

/**
 * One stroke-icon set for the whole system: menu categories, the
 * fourteen EU allergens, dietary tags and interface actions.
 *
 * All drawn on a 24x24 grid with a 1.7 stroke so they sit together at
 * any size, and all inherit currentColor so a single icon works on the
 * light counter and the dark kitchen screen alike.
 */

export type IconName =
  // categories
  | 'OLIVE' | 'BOWL' | 'FISH' | 'MEAT' | 'LEAF' | 'CAKE' | 'CUP' | 'WINE' | 'UTENSILS'
  // allergens
  | 'WHEAT' | 'SHRIMP' | 'EGG' | 'PEANUT' | 'SOY' | 'MILK' | 'NUT'
  | 'CELERY' | 'MUSTARD' | 'SESAME' | 'SULPHITE' | 'LUPIN' | 'SQUID'
  // diet tags
  | 'SPROUT' | 'NOGLUTEN' | 'CHILLI' | 'STAR'
  // interface
  | 'plus' | 'minus' | 'check' | 'x' | 'chevron-left' | 'chevron-right'
  | 'chevron-down' | 'bell' | 'receipt' | 'split' | 'clock' | 'users'
  | 'grid' | 'calendar' | 'chart' | 'lock' | 'globe' | 'search' | 'filter'
  | 'wifi' | 'wifi-off' | 'trash' | 'arrow-right' | 'shield' | 'flame'
  | 'coins' | 'card' | 'phone' | 'bank' | 'sparkle' | 'broom' | 'printer'
  | 'info' | 'alert' | 'kitchen' | 'tablet' | 'counter';

const PATHS: Record<IconName, ReactElement> = {
  // ---- categories -------------------------------------------------
  OLIVE: <><ellipse cx="10" cy="14" rx="4.5" ry="6" /><ellipse cx="16.5" cy="10" rx="3.5" ry="4.6" /><path d="M10 8V5M16.5 5.4V3.5" /></>,
  BOWL: <><path d="M3 11h18a9 9 0 0 1-18 0Z" /><path d="M8 7.5c0-1.6 1.2-2.5 1.2-2.5M12 7c0-2 1.4-3 1.4-3M16 7.5c0-1.6 1.2-2.5 1.2-2.5" /></>,
  FISH: <><path d="M3 12c3.5-4.5 8-6.5 12-6.5 3 0 5 1.5 6 3-1 1.5-1 5.5 0 7-1 1.5-3 3-6 3-4 0-8.5-2-12-6.5Z" /><circle cx="16.5" cy="10.5" r=".9" fill="currentColor" /><path d="M7 12h4" /></>,
  MEAT: <><path d="M7 17.5c-2.5-2.5-2.5-7 1-10.5S16 3.5 18 6s1 6-1.5 8.5c-1.5 1.5-2 2-2 3.5 0 1.2-1 2-2.2 2S10 19.2 10 18c0-1.5-1-1-3-.5Z" /><circle cx="13.5" cy="10.5" r="2.4" /></>,
  LEAF: <><path d="M20 4C10 4 4 9 4 16c0 2.2.8 4 .8 4S8 13 20 11Z" /><path d="M5 20c2-6 7-9 13-10" /></>,
  CAKE: <><path d="M4 19V12h16v7Z" /><path d="M4 14h16" /><path d="M8 12V9M12 12V8.5M16 12V9" /><circle cx="8" cy="7.5" r="1.2" /><circle cx="12" cy="7" r="1.2" /><circle cx="16" cy="7.5" r="1.2" /></>,
  CUP: <><path d="M5 6h12v8a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5Z" /><path d="M17 8h2.5a2.5 2.5 0 0 1 0 5H17" /><path d="M4 21h14" /></>,
  WINE: <><path d="M8 4h8l-.6 6a3.4 3.4 0 0 1-6.8 0Z" /><path d="M12 13.5V20M9 20h6" /><path d="M8.2 8h7.6" /></>,
  UTENSILS: <><path d="M7 3v8a2 2 0 0 0 4 0V3M9 13v8" /><path d="M16 3c-1.5 2-1.5 5 0 6.5V21" /></>,

  // ---- allergens --------------------------------------------------
  WHEAT: <><path d="M12 21V9" /><path d="M12 9c-2.5 0-4-1.6-4-4 2.5 0 4 1.6 4 4ZM12 9c2.5 0 4-1.6 4-4-2.5 0-4 1.6-4 4Z" /><path d="M12 15c-2.5 0-4-1.6-4-4 2.5 0 4 1.6 4 4ZM12 15c2.5 0 4-1.6 4-4-2.5 0-4 1.6-4 4Z" /></>,
  SHRIMP: <><path d="M19 7c-6 0-10 3-10 7 0 3 2 5 5 5 4 0 6-3 6-6" /><path d="M9 14c-3 0-5-1.5-5-4M11 9.5C9 8 8 6 8.5 4" /><circle cx="17" cy="9.5" r=".9" fill="currentColor" /></>,
  EGG: <><ellipse cx="12" cy="13.5" rx="6.5" ry="8" /><ellipse cx="12" cy="14" rx="2.6" ry="2.6" /></>,
  PEANUT: <><path d="M9 3c2.5 0 4 1.8 4 4s-1 2.8-1 4.5 1 2.5 1 4.5-1.5 4-4 4-4.5-2-4.5-4.4c0-2 1-2.8 1-4.6S4.5 8.4 4.5 7 6.5 3 9 3Z" transform="translate(3)" /><path d="M8 11h8" /></>,
  SOY: <><path d="M5 14c0-4 3.5-7 8-7s6 2.5 6 5-2 4-4.5 4c-2 0-3-1-3-2.5" /><circle cx="9" cy="14.5" r="2" /><circle cx="15" cy="12.5" r="2" /></>,
  MILK: <><path d="M9 3h6v3l2 4v11H7V10l2-4Z" /><path d="M7 13h10" /></>,
  NUT: <><path d="M12 3c4 2 6 5 6 8.5S15.5 21 12 21s-6-6-6-9.5S8 5 12 3Z" /><path d="M12 5v14M8 12h8" /></>,
  CELERY: <><path d="M8 21V8M12 21V5M16 21V8" /><path d="M6 21h12" /><path d="M8 8c-1.5-1-2-2.5-1.5-4M16 8c1.5-1 2-2.5 1.5-4" /></>,
  MUSTARD: <><path d="M9 4h6v2l1.5 3v12h-9V9L9 6Z" /><path d="M10.5 12h3M10.5 15.5h3" /></>,
  SESAME: <><ellipse cx="8" cy="9" rx="2.6" ry="1.6" transform="rotate(-25 8 9)" /><ellipse cx="15" cy="11" rx="2.6" ry="1.6" transform="rotate(20 15 11)" /><ellipse cx="11" cy="16" rx="2.6" ry="1.6" transform="rotate(-10 11 16)" /></>,
  SULPHITE: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5M12 15.8v.4" /></>,
  LUPIN: <><path d="M12 21c0-5 2-9 5-11-3.5-.5-6.5 1.5-8 5" /><path d="M12 21c0-5-2-9-5-11 3.5-.5 6.5 1.5 8 5" /><path d="M12 21V13" /></>,
  SQUID: <><ellipse cx="12" cy="8" rx="5" ry="4.5" /><path d="M8 12c-.5 3-1.5 5-3 6.5M10.5 12.4c-.3 3.5-.3 6-.3 7.6M13.5 12.4c.3 3.5.3 6 .3 7.6M16 12c.5 3 1.5 5 3 6.5" /></>,

  // ---- diet tags --------------------------------------------------
  SPROUT: <><path d="M12 21v-8" /><path d="M12 13c-3.5 0-5.5-2-5.5-5.5 3.5 0 5.5 2 5.5 5.5Z" /><path d="M12 13c3.5 0 5.5-2 5.5-5.5-3.5 0-5.5 2-5.5 5.5Z" /></>,
  NOGLUTEN: <><path d="M12 18V10" /><path d="M12 10c-2 0-3.3-1.3-3.3-3.3C11 6.7 12 8 12 10Z" /><path d="M12 10c2 0 3.3-1.3 3.3-3.3C13 6.7 12 8 12 10Z" /><circle cx="12" cy="12" r="9.2" /><path d="M5.4 18.6 18.6 5.4" /></>,
  CHILLI: <><path d="M17 6c-1 5-5 9-9.5 9C5 15 4 13.5 4 12c4 0 8-3 9-6" /><path d="M17 6c0-1.5 1-2.5 2.5-2.5" /></>,
  STAR: <><path d="m12 3.5 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17.3l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" /></>,

  // ---- interface --------------------------------------------------
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m4 12.5 5.2 5.2L20 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  'chevron-left': <path d="m14.5 5-7 7 7 7" />,
  'chevron-right': <path d="m9.5 5 7 7-7 7" />,
  'chevron-down': <path d="m5 9.5 7 7 7-7" />,
  bell: <><path d="M6 10a6 6 0 0 1 12 0c0 5 1.5 6.5 1.5 6.5h-15S6 15 6 10Z" /><path d="M9.5 20a2.6 2.6 0 0 0 5 0" /></>,
  receipt: <><path d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21Z" /><path d="M9.5 8h5M9.5 12h5" /></>,
  split: <><path d="M12 4v6M12 14v6" /><path d="M5 12h14" /><path d="m8.5 7.5 3.5-3.5 3.5 3.5M8.5 16.5 12 20l3.5-3.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.2 2" /></>,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" /><path d="M16 6.2a3.2 3.2 0 0 1 0 6.1M17.5 14.8c1.8.8 3 2.6 3 5.2" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></>,
  calendar: <><rect x="3.5" y="5.5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8.5 3.5v4M15.5 3.5v4" /></>,
  chart: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8.5 20v-6M13 20V8.5M17.5 20v-9" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.6" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><circle cx="12" cy="15.5" r="1.3" fill="currentColor" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5S9.6 5.8 12 3.5Z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  filter: <><path d="M4 6h16l-6 7v6l-4-2v-4Z" /></>,
  wifi: <><path d="M2.5 9a14 14 0 0 1 19 0" /><path d="M6 12.5a9 9 0 0 1 12 0" /><path d="M9.3 16a4.5 4.5 0 0 1 5.4 0" /><circle cx="12" cy="19.3" r="1.1" fill="currentColor" /></>,
  'wifi-off': <><path d="M2.5 9a14 14 0 0 1 6-3.6M15.5 5.4A14 14 0 0 1 21.5 9" /><path d="M6 12.5a9 9 0 0 1 3.2-2.1" /><circle cx="12" cy="19.3" r="1.1" fill="currentColor" /><path d="M3.5 3.5l17 17" /></>,
  trash: <><path d="M4.5 7h15" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7l1 13h9l1-13" /><path d="M10.5 11v5.5M13.5 11v5.5" /></>,
  'arrow-right': <><path d="M4 12h15" /><path d="m13.5 6.5 6 5.5-6 5.5" /></>,
  shield: <><path d="M12 3.5 19.5 6v6c0 4.5-3.2 7.5-7.5 9-4.3-1.5-7.5-4.5-7.5-9V6Z" /><path d="m8.8 12 2.4 2.4 4-4.4" /></>,
  flame: <><path d="M12 21c3.6 0 6-2.3 6-5.5 0-4.5-4.5-5.5-3.5-12C11 5.5 6 8.5 6 15.5 6 18.7 8.4 21 12 21Z" /><path d="M12 21c1.6 0 2.7-1.2 2.7-2.8 0-2.2-2.2-2.8-1.7-5.7-1.6 1.5-3.7 2.8-3.7 5.7 0 1.6 1.1 2.8 2.7 2.8Z" /></>,
  coins: <><ellipse cx="12" cy="6.5" rx="7.5" ry="3" /><path d="M4.5 6.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" /><path d="M4.5 11.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2.6" /><path d="M3 10h18" /><path d="M6.5 14.5h4" /></>,
  phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.6" /><path d="M10.5 18.5h3" /></>,
  bank: <><path d="M3.5 9.5 12 4l8.5 5.5" /><path d="M5.5 9.5v9M18.5 9.5v9M10 9.5v9M14 9.5v9" /><path d="M3 20.5h18" /></>,
  sparkle: <><path d="M12 3.5 13.5 9l5.5 1.5-5.5 1.5L12 17.5 10.5 12 5 10.5 10.5 9Z" /><path d="M18.5 16.5 19.3 19l2.5.8-2.5.8-.8 2.5" /></>,
  broom: <><path d="M14 3.5 8.5 12" /><path d="M5 20.5c-.5-3.5 1-6 4-7.5l4.5 3c-1 3-3.5 4.5-8.5 4.5Z" /><path d="M9.5 14 7 19M12 15.5l-2 4.5" /></>,
  printer: <><rect x="6" y="3.5" width="12" height="5" rx="1.4" /><path d="M6 8.5h-.5A2.5 2.5 0 0 0 3 11v5h3" /><path d="M18 8.5h.5A2.5 2.5 0 0 1 21 11v5h-3" /><rect x="6" y="13.5" width="12" height="7" rx="1.4" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><circle cx="12" cy="8" r="1" fill="currentColor" /></>,
  alert: <><path d="M12 3.5 21.5 20h-19Z" /><path d="M12 9.5v5" /><circle cx="12" cy="17" r="1" fill="currentColor" /></>,
  kitchen: <><path d="M3.5 4.5h17v5h-17Z" /><path d="M5 9.5v10M19 9.5v10M3.5 19.5h17" /><path d="M9 13h6" /><circle cx="7" cy="7" r=".9" fill="currentColor" /></>,
  tablet: <><rect x="4" y="2.5" width="16" height="19" rx="2.6" /><path d="M10 19h4" /></>,
  counter: <><path d="M2.5 11.5h19" /><path d="M4.5 11.5V20M19.5 11.5V20" /><path d="M6 11.5 8 5h8l2 6.5" /><path d="M2 20h20" /></>,
};

export function Icon({
  name,
  className = 'size-5',
  strokeWidth = 1.7,
  filled = false,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}

/** Maps a database icon code to an icon, falling back safely. */
export function iconFor(code: string | undefined | null): IconName {
  if (code && code in PATHS) return code as IconName;
  return 'UTENSILS';
}
