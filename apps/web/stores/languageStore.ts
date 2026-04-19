import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Locale } from '@teeko/shared/types'
import i18n from '@/lib/i18n'

interface LanguageStore {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => {
        set({ locale })
        i18n.changeLanguage(locale)
      },
    }),
    { name: 'teeko_locale' }
  )
)
