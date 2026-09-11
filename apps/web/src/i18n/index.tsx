import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { pt, type Dict } from './strings';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import type { Locale } from '../lib/format';

const DICTS: Record<Locale, Dict> = {
  pt,
  en: en as Dict,
  es: es as Dict,
  fr: fr as Dict,
};

export const LOCALES: Array<{ code: Locale; label: string; flag: string }> = [
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

/**
 * A path into the dictionary: 'menu.soldOut', 'common.tableN'.
 * Typed to the depth the dictionary actually uses.
 */
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Dict>;

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  dict: Dict;
};

const I18nContext = createContext<Ctx | null>(null);

const STORAGE_KEY = 'mesa.locale';

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in DICTS) return saved as Locale;
  } catch {
    /* storage unavailable */
  }
  // Fall back to the browser, then to Portuguese: this is a Portuguese
  // restaurant, so pt is the right default for anyone unrecognised.
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  return (nav && nav in DICTS ? nav : 'pt') as Locale;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'pt' ? 'pt-PT' : locale;
  }, [locale]);

  const value = useMemo<Ctx>(() => {
    const dict = DICTS[locale] ?? pt;

    const t = (key: TKey, vars?: Record<string, string | number>) => {
      // Walk the dotted path, falling back to Portuguese, then to the
      // key itself so a missing string is visible rather than blank.
      const read = (source: unknown): string | null => {
        let node: any = source;
        for (const part of key.split('.')) {
          if (node == null || typeof node !== 'object') return null;
          node = node[part];
        }
        return typeof node === 'string' ? node : null;
      };

      let text = read(dict) ?? read(pt) ?? key;
      if (vars) {
        for (const [name, v] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(v));
        }
      }
      return text;
    };

    return { locale, setLocale, t, dict };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

/** Shorthand for the common case of only needing the translator. */
export function useT() {
  return useI18n().t;
}
