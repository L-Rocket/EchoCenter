import { createContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'en' | 'zh-CN';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  tx: (enText: string, zhText: string) => string;
  isZh: boolean;
}

const STORAGE_KEY = 'echocenter-locale';

const defaultValue: I18nContextValue = {
  locale: 'en',
  setLocale: () => null,
  tx: (enText) => enText,
  isZh: false,
};

export const I18nContext = createContext<I18nContextValue>(defaultValue);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh-CN') return saved;
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => setLocaleState(next),
      tx: (enText, zhText) => (locale === 'zh-CN' ? zhText : enText),
      isZh: locale === 'zh-CN',
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
