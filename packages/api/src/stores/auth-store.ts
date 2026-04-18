import type { Locale, Rider } from '@teeko/shared';
import { create } from 'zustand';

import * as authApi from '../mock/handlers/auth';

export type AuthStatus = 'unknown' | 'guest' | 'otp_pending' | 'authed';

export type AuthState = {
  rider: Rider | null;
  status: AuthStatus;
  challengeId: string | null;
  pendingPhone: string | null;
  languagePref: Locale;
  startLogin: (phone: string) => Promise<void>;
  confirmOtp: (code: string) => Promise<void>;
  resetChallenge: () => void;
  hydrate: () => Promise<void>;
  setLanguage: (locale: Locale) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  rider: null,
  status: 'unknown',
  challengeId: null,
  pendingPhone: null,
  languagePref: 'en',

  async startLogin(phone) {
    const { challengeId } = await authApi.sendOtp(phone);
    set({ challengeId, pendingPhone: phone, status: 'otp_pending' });
  },

  async confirmOtp(code) {
    const { challengeId } = get();
    if (!challengeId) throw new Error('No pending OTP challenge');
    const rider = await authApi.verifyOtp(challengeId, code);
    set({ rider, status: 'authed', challengeId: null, pendingPhone: null });
  },

  resetChallenge() {
    set({ challengeId: null, pendingPhone: null, status: 'guest' });
  },

  async hydrate() {
    // v0.1: no persisted token, so hydrate always resolves to guest.
    const rider = await authApi.me();
    set({ rider, status: rider ? 'authed' : 'guest' });
  },

  setLanguage(languagePref) {
    set({ languagePref });
  },

  logout() {
    set({ rider: null, status: 'guest', challengeId: null, pendingPhone: null });
  },
}));
