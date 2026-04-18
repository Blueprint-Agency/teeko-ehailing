// @teeko/i18n — i18next + react-i18next setup, locale loaders, useT() hook.
// Filled in during Phase A (auth) and Phase E (polish) of the rider mockup plan.
// Intended exports: i18n (init fn), useT, LanguageProvider, detectInitialLanguage.

import type { Locale } from '@teeko/shared';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ms', 'zh', 'ta'];
export const DEFAULT_LOCALE: Locale = 'en';

export const I18N_PACKAGE_VERSION = '0.1.0';
