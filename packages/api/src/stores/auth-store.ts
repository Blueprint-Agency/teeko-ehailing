import type { Locale, Rider } from '@teeko/shared';
import { create } from 'zustand';

import * as authApi from '../mock/handlers/auth';

export type AuthStatus = 'unknown' | 'guest' | 'pending_verification' | 'authed';

export type AuthState = {
  rider: Rider | null;
  status: AuthStatus;
  pendingEmail: string | null;
  pendingName: string | null;
  pendingToken: string | null;
  languagePref: Locale;

  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  verifyEmail: () => Promise<void>;
  resendVerification: () => Promise<void>;
  resetVerification: () => void;

  hydrate: () => Promise<void>;
  setLanguage: (locale: Locale) => void;
  updateRider: (patch: Partial<Pick<Rider, 'name' | 'email'>>) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  rider: null,
  status: 'unknown',
  pendingEmail: null,
  pendingName: null,
  pendingToken: null,
  languagePref: 'en',

  async signUpWithEmail(name, email, password) {
    const { verifyToken } = await authApi.signUpWithEmail(name, email, password);
    set({
      status: 'pending_verification',
      pendingEmail: email,
      pendingName: name,
      pendingToken: verifyToken,
    });
  },

  async signInWithEmail(email, password) {
    const rider = await authApi.signInWithEmail(email, password);
    set({
      rider,
      status: 'authed',
      pendingEmail: null,
      pendingName: null,
      pendingToken: null,
    });
  },

  async signInWithGoogle() {
    const rider = await authApi.signInWithGoogle();
    set({
      rider,
      status: 'authed',
      pendingEmail: null,
      pendingName: null,
      pendingToken: null,
    });
  },

  async verifyEmail() {
    const { pendingToken, pendingEmail, pendingName } = get();
    if (!pendingToken || !pendingEmail) {
      throw new Error('No pending verification');
    }
    const rider = await authApi.verifyEmail(pendingToken, pendingName ?? '', pendingEmail);
    set({
      rider,
      status: 'authed',
      pendingEmail: null,
      pendingName: null,
      pendingToken: null,
    });
  },

  async resendVerification() {
    const { pendingToken } = get();
    if (!pendingToken) return;
    await authApi.resendVerification(pendingToken);
  },

  resetVerification() {
    set({
      status: 'guest',
      pendingEmail: null,
      pendingName: null,
      pendingToken: null,
    });
  },

  async hydrate() {
    // v0.1: no persisted token, so hydrate always resolves to guest.
    const rider = await authApi.me();
    set({ rider, status: rider ? 'authed' : 'guest' });
  },

  setLanguage(languagePref) {
    set({ languagePref });
  },

  updateRider(patch) {
    const current = get().rider;
    if (!current) return;
    set({ rider: { ...current, ...patch } });
  },

  logout() {
    set({
      rider: null,
      status: 'guest',
      pendingEmail: null,
      pendingName: null,
      pendingToken: null,
    });
  },
}));
