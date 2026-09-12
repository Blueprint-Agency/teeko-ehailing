import type { Locale, Rider } from '@teeko/shared';
import { create } from 'zustand';

import * as authApi from '../client/auth';

export type AuthState = {
  rider: Rider | null;
  languagePref: Locale;
  /**
   * ISO-2s the rider has picked in the country sheet, most recent first. Kept
   * in memory only — a convenience for ordering the list, not data worth
   * persisting or sending anywhere.
   */
  recentCountries: string[];

  fetchProfile: () => Promise<void>;
  // `phone` is not patchable: a change needs an OTP and is capped at one per
  // 30 days. Use setInitialPhone / changePhone / requestEarlyPhoneChange.
  updateProfile: (patch: { fullName?: string; locale?: Locale }) => Promise<void>;
  setInitialPhone: (input: authApi.PhoneInput) => Promise<void>;
  changePhone: (input: authApi.PhoneInput & { otpCode: string }) => Promise<string>;
  requestEarlyPhoneChange: (
    input: authApi.PhoneInput & { otpCode: string; reason: string },
  ) => Promise<void>;
  rememberCountry: (iso2: string) => void;
  uploadAvatar: (file: { uri: string; name?: string; mimeType?: string }) => Promise<void>;
  removeAvatar: () => Promise<void>;
  setLanguage: (locale: Locale) => Promise<void>;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  rider: null,
  languagePref: 'en',
  recentCountries: [],

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

  async setInitialPhone(input) {
    const res = await authApi.setInitialPhone(input);
    get().rememberCountry(input.countryCode);
    const current = get().rider;
    // `phoneChangedAt` stays undefined: the first capture is not a "change",
    // so the rider's first real change must not be blocked by a cooldown.
    if (current) set({ rider: { ...current, phone: res.phone, phoneCountry: res.phoneCountry } });
  },

  /** Resolves with the ISO instant the next change unlocks. */
  async changePhone(input) {
    const res = await authApi.changePhone(input);
    get().rememberCountry(input.countryCode);
    const current = get().rider;
    if (current) {
      set({
        rider: {
          ...current,
          phone: res.phone,
          phoneCountry: res.phoneCountry,
          phoneChangedAt: new Date().toISOString(),
        },
      });
    }
    return res.nextAllowedAt;
  },

  async requestEarlyPhoneChange(input) {
    await authApi.requestEarlyPhoneChange(input);
    get().rememberCountry(input.countryCode);
    // Nothing on the rider changes yet — an admin has to approve it first.
  },

  rememberCountry(iso2) {
    set({ recentCountries: [iso2, ...get().recentCountries.filter((c) => c !== iso2)].slice(0, 5) });
  },

  async uploadAvatar(file) {
    const avatarUrl = await authApi.uploadAvatar(file);
    const current = get().rider;
    if (current) set({ rider: { ...current, avatarUrl } });
  },

  async removeAvatar() {
    await authApi.removeAvatar();
    const current = get().rider;
    if (current) set({ rider: { ...current, avatarUrl: undefined } });
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
