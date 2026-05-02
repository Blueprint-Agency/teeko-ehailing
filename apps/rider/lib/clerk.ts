// Clerk token cache (expo-secure-store-backed) + a getter bridge so
// non-React code (the api client) can read the current Clerk token.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { TokenCache } from '@clerk/clerk-expo';

export const tokenCache: TokenCache = {
  async getToken(key) {
    try {
      if (Platform.OS === 'web') return null; // Clerk web SDK uses cookies
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key, value) {
    if (Platform.OS === 'web') return;
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore — secure-store may be unavailable in some environments
    }
  },
};

// Bridge: the client/_fetch.ts module calls getToken() to inject Authorization.
// _layout.tsx registers the actual getter once Clerk is mounted (Task B3).
let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>): void {
  tokenGetter = fn;
}

export async function getToken(): Promise<string | null> {
  if (!tokenGetter) return null;
  return tokenGetter();
}
