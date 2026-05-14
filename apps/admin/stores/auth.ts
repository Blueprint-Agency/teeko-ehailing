'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MOCK_ACCOUNTS, type MockAccount } from '@/lib/mock-accounts';

interface AuthState {
  isAuthenticated: boolean;
  profile: MockAccount | null;
  themeMode: 'light' | 'dark';
  login: (email: string, password: string) => boolean;
  logout: () => void;
  toggleTheme: () => void;
}

export const useAdminAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      profile: null,
      themeMode: 'light',
      login: (email, password) => {
        const account = MOCK_ACCOUNTS.find(
          (a) => a.email === email && a.password === password
        );
        if (!account) return false;
        set({ isAuthenticated: true, profile: account });
        document.cookie = 'teeko_admin_session=1; path=/';
        return true;
      },
      logout: () => {
        set({ isAuthenticated: false, profile: null });
        document.cookie = 'teeko_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      },
      toggleTheme: () =>
        set((s) => ({ themeMode: s.themeMode === 'light' ? 'dark' : 'light' })),
    }),
    { name: 'teeko_admin_auth', storage: createJSONStorage(() => (typeof window !== 'undefined' ? sessionStorage : localStorage)) }
  )
);
