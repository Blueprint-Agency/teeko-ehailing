import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Locale } from '@teeko/shared/types'

interface LanguageStore {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'teeko_locale' }
  )
)
