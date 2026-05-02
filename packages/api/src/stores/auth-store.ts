import type { Locale, Rider } from '@teeko/shared';
import { create } from 'zustand';

import * as authApi from '../client/auth';

export type AuthState = {
  rider: Rider | null;
  languagePref: Locale;

  fetchProfile: () => Promise<void>;
  updateProfile: (patch: { fullName?: string; locale?: Locale }) => Promise<void>;
  setLanguage: (locale: Locale) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  rider: null,
  languagePref: 'en',

  async fetchProfile() {
    const rider = await authApi.getMe();
    set({ rider, languagePref: rider.languagePref });
  },

  async updateProfile(patch) {
    await authApi.updateMe(patch);
    const current = get().rider;
    if (current) {
      set({
        rider: {
          ...current,
          ...(patch.fullName !== undefined ? { name: patch.fullName } : {}),
          ...(patch.locale !== undefined ? { languagePref: patch.locale } : {}),
        },
      });
    }
  },

  setLanguage(languagePref) {
    set({ languagePref });
  },

  clear() {
    set({ rider: null });
  },
}));
