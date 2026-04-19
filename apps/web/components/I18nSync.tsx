'use client'

import { useEffect } from 'react'
import { useLanguageStore } from '@/stores/languageStore'
import i18n from '@/lib/i18n'

export function I18nSync() {
  const { locale } = useLanguageStore()

  useEffect(() => {
    // Sync i18n with store on mount (initial load)
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale)
    }
  }, [locale])

  return null
}
