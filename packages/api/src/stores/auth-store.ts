import type { Locale, Rider } from '@teeko/shared';
import { create } from 'zustand';

import * as authApi from '../client/auth';

export type AuthState = {
  rider: Rider | null;
  languagePref: Locale;

  fetchProfile: () => Promise<void>;
  updateProfile: (patch: { fullName?: string; locale?: Locale }) => Promise<void>;
  setLanguage: (locale: Locale) => Promise<void>;
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

  async setLanguage(languagePref) {
    // Switch immediately for instant UI feedback (and to cover guests, who have
    // no server profile to persist to).
    set({ languagePref });
    // Persist for signed-in riders — otherwise the next fetchProfile() would
    // reset languagePref to the server's stale value and revert the UI.
    const current = get().rider;
    if (!current) return;
    try {
      await authApi.updateMe({ locale: languagePref });
      set({ rider: { ...current, languagePref } });
    } catch (err) {
      console.warn('[auth] setLanguage persist failed', err);
      // Local switch stays in effect; will retry on the next change.
    }
  },

  clear() {
    set({ rider: null });
  },
}));
