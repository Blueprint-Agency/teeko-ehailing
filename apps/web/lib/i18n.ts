'use client'

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from '@teeko/shared/locales/en.json'
import ms from '@teeko/shared/locales/ms.json'
import zh from '@teeko/shared/locales/zh.json'
import ta from '@teeko/shared/locales/ta.json'

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        ms: { translation: ms },
        zh: { translation: zh },
        ta: { translation: ta },
      },
      fallbackLng: 'en',
      supportedLngs: ['en', 'ms', 'zh', 'ta'],
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'teeko_locale',
      },
    })
}

export default i18n
