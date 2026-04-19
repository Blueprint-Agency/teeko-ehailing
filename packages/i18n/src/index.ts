import type { Locale } from '@teeko/shared';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import en from './locales/en.json';
import ms from './locales/ms.json';
import ta from './locales/ta.json';
import zh from './locales/zh.json';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ms', 'zh', 'ta'];
export const DEFAULT_LOCALE: Locale = 'en';
export const I18N_PACKAGE_VERSION = '0.1.0';

let initialized = false;

export function initI18n(initialLocale: Locale = DEFAULT_LOCALE) {
  if (initialized) return i18n;
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ms: { translation: ms },
      zh: { translation: zh },
      ta: { translation: ta },
    },
    lng: initialLocale,
    fallbackLng: 'en',
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  initialized = true;
  return i18n;
}

export function setLocale(locale: Locale) {
  if (!initialized) initI18n(locale);
  return i18n.changeLanguage(locale);
}

export function useT() {
  const { t } = useTranslation();
  return t;
}

export { i18n };
