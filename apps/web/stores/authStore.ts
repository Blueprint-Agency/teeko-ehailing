import { create } from 'zustand'
import type { DriverProfile } from '@teeko/shared/types'
import { api } from '@/lib/api'

const DEV_DRIVER_ID = process.env.NEXT_PUBLIC_DEV_DRIVER_ID ?? '00000000-0000-0000-0000-000000000001'

// Clerk owns the session now, so this store is no longer persisted — it is a
// cache of the driver row + application state, rehydrated from GET /auth/me.
// `isAuthenticated` means "we have resolved our own row for the Clerk session",
// not "allowed to drive" — that is `applicationState` / admin approval.
interface WebAuthStore {
  isAuthenticated: boolean
  profile: DriverProfile | null
  applicationState: string | null
  approvalStatus: string | null
  emailVerified: boolean
  hydrating: boolean
  hydrate: () => Promise<void>
  clear: () => void
  devRole: 'new' | 'returning'
  setDevRole: (role: 'new' | 'returning') => void
  updateProfile: (updates: Partial<DriverProfile>) => void
}

export const useWebAuthStore = create<WebAuthStore>()((set) => ({
  isAuthenticated: false,
  profile: null,
  applicationState: null,
  approvalStatus: null,
  emailVerified: false,
  hydrating: false,
  devRole: 'new',

  // Resolves the active Clerk session into our driver row, provisioning it on
  // first call. Safe to call repeatedly.
  hydrate: async () => {
    set({ hydrating: true })
    try {
      const me = await api.getMe()
      const account = await api.getAccount(me.user.id).catch(() => null)
      set({
        isAuthenticated: true,
        profile:
          account ??
          ({
            id: me.user.id,
            fullName: me.user.fullName ?? '',
            phone: '',
            email: me.user.email ?? '',
            onboardingStep: 0,
            agreementAccepted: false,
          } as DriverProfile),
        applicationState: me.application?.state ?? null,
        approvalStatus: me.driverProfile.approvalStatus,
        emailVerified: me.user.emailVerified,
      })
    } catch {
      set({ isAuthenticated: false, profile: null, applicationState: null })
    } finally {
      set({ hydrating: false })
    }
  },

  clear: () =>
    set({
      isAuthenticated: false,
      profile: null,
      applicationState: null,
      approvalStatus: null,
      emailVerified: false,
    }),

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
}))
