import React, { createContext, useContext, useState } from 'react';
import type { Locale } from '@teeko/shared';
import { initI18n, setLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@teeko/i18n';

initI18n(DEFAULT_LOCALE);

type LocaleContextValue = {
  locale: Locale;
  changeLocale: (l: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  changeLocale: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  const changeLocale = (l: Locale) => {
    setLocale(l);
    setLocaleState(l);
  };

  return (
    <LocaleContext.Provider value={{ locale, changeLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export { SUPPORTED_LOCALES };
