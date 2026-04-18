import { createContext, useMemo } from 'react';

export type Locale = 'en';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  tx: (enText: string, zhText?: string) => string;
  isZh: boolean;
}

const defaultValue: I18nContextValue = {
  locale: 'en',
  setLocale: () => null,
  tx: (enText) => enText,
  isZh: false,
};

export const I18nContext = createContext<I18nContextValue>(defaultValue);

// v3 is English-only. The provider still exists so that existing `useI18n()`
// callsites keep working (tx(en, zh) → en), but the locale is frozen.
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale: 'en',
      setLocale: () => null,
      tx: (enText) => enText,
      isZh: false,
    }),
    []
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
