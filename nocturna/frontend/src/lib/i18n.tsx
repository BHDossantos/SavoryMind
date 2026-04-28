'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { LOCALES, type Locale, t as translate } from '../../../shared/i18n/dictionaries';

interface Ctx { locale: Locale; setLocale: (l: Locale) => void; t: (key: string, vars?: Record<string, any>) => string }
const I18nContext = createContext<Ctx>({ locale: 'en', setLocale: () => {}, t: (k) => k });

const COOKIE = 'nocturna.locale';

function readLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const m = document.cookie.match(new RegExp(`${COOKIE}=([a-z]{2})`));
  if (m && (LOCALES as readonly string[]).includes(m[1])) return m[1] as Locale;
  const nav = navigator.language?.slice(0, 2);
  return (nav && (LOCALES as readonly string[]).includes(nav) ? nav : 'en') as Locale;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => { setLocaleState(readLocale()); }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof document !== 'undefined') {
      document.cookie = `${COOKIE}=${l};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
      document.documentElement.lang = l;
    }
  }, []);

  const t = useCallback((key: string, vars?: Record<string, any>) => translate(locale, key, vars), [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}

export { LOCALES };
export type { Locale };
