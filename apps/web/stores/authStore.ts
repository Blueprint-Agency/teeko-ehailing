import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DriverProfile } from '@teeko/shared/types'
import { api } from '@/lib/api'

const DEV_DRIVER_ID = process.env.NEXT_PUBLIC_DEV_DRIVER_ID ?? '00000000-0000-0000-0000-000000000001'

interface WebAuthStore {
  isAuthenticated: boolean
  profile: DriverProfile | null
  devRole: 'new' | 'returning'
  login: (profile: DriverProfile) => void
  logout: () => void
  setDevRole: (role: 'new' | 'returning') => void
  updateProfile: (updates: Partial<DriverProfile>) => void
}

export const useWebAuthStore = create<WebAuthStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      profile: null,
      devRole: 'new',

      login: (profile) => set({ isAuthenticated: true, profile }),

      logout: () => set({ isAuthenticated: false, profile: null }),

      setDevRole: async (role) => {
        if (role === 'returning') {
          set({ devRole: role })
          try {
            const profile = await api.getAccount(DEV_DRIVER_ID)
            set({ isAuthenticated: true, profile })
          } catch {
            // Fallback if backend is not running
            set({
              isAuthenticated: true,
              profile: {
                id: DEV_DRIVER_ID,
                fullName: 'Ahmad Faizal bin Hamdan',
                phone: '+60123456789',
                email: 'faizal@example.com',
                onboardingStep: 3,
                agreementAccepted: true,
                agreementTimestamp: '2025-01-10T09:00:00Z',
              },
            })
          }
        } else {
          set({ devRole: role, isAuthenticated: false, profile: null })
        }
      },

      updateProfile: (updates) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...updates } : null,
        })),
    }),
    {
      name: 'teeko_auth',
      storage: {
        getItem: (k) => {
          if (typeof sessionStorage === 'undefined') return null
          const v = sessionStorage.getItem(k)
          return v ? JSON.parse(v) : null
        },
        setItem: (k, v) => sessionStorage.setItem(k, JSON.stringify(v)),
        removeItem: (k) => sessionStorage.removeItem(k),
      },
    }
  )
)
