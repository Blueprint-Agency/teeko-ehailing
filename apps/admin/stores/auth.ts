'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MOCK_ACCOUNTS, type MockAccount } from '@/lib/mock-accounts';

// Keep the cookie's lifetime in step with the persisted store below. The
// middleware trusts the cookie while the panel/RBAC trust the store, so if the
// two expire on different schedules they diverge — cookie present but store
// empty — and the app dead-locks in a /login ⇄ /dashboard redirect loop that
// only clearing cookies escapes.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface AuthState {
  isAuthenticated: boolean;
  profile: MockAccount | null;
  themeMode: 'light' | 'dark';
  /** True once persisted state has rehydrated on the client. */
  hasHydrated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  toggleTheme: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAdminAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      profile: null,
      themeMode: 'light',
      hasHydrated: false,
      login: (email, password) => {
        const account = MOCK_ACCOUNTS.find(
          (a) => a.email === email && a.password === password
        );
        if (!account) return false;
        set({ isAuthenticated: true, profile: account });
        document.cookie = `teeko_admin_session=1; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; samesite=lax`;
        return true;
      },
      logout: () => {
        set({ isAuthenticated: false, profile: null });
        document.cookie = 'teeko_admin_session=; path=/; max-age=0';
      },
      toggleTheme: () =>
        set((s) => ({ themeMode: s.themeMode === 'light' ? 'dark' : 'light' })),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'teeko_admin_auth',
      // localStorage (not sessionStorage) so the store survives tab close and
      // browser restart, matching the cookie's max-age. sessionStorage is
      // per-tab and vanishes on close, leaving a live cookie with no store.
      storage: createJSONStorage(() => localStorage),
      // Persist only real state — never `hasHydrated`, which must start false on
      // every load so the layout waits for rehydration before judging auth.
      partialize: (s) => ({
        isAuthenticated: s.isAuthenticated,
        profile: s.profile,
        themeMode: s.themeMode,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
