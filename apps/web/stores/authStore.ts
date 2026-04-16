import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DriverProfile } from '@teeko/shared/types'
import mockProfile from '@/data/mock-driver-profile.json'

interface WebAuthStore {
  isAuthenticated: boolean
  profile: DriverProfile | null
  // Dev toggle: simulate returning (post-submission) driver
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

      setDevRole: (role) => {
        if (role === 'returning') {
          set({
            devRole: role,
            isAuthenticated: true,
            profile: mockProfile as DriverProfile,
          })
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
