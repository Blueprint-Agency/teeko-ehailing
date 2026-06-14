import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { ThemeProvider, useTheme } from '../components/ThemeProvider';
import { useColors } from '../constants/colors';
import { LocaleProvider } from '../providers/LocaleProvider';
import { useDriverStore } from '../store/useDriverStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { api, registerTokenGetter } from '../lib/api';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

const tokenCache = {
  getToken: async (key: string) => {
    const val = await SecureStore.getItemAsync(key);
    console.log('[Clerk cache] getToken', key, val ? `found (${val.length} chars)` : 'null/missing');
    return val;
  },
  saveToken: async (key: string, value: string) => {
    console.log('[Clerk cache] saveToken', key, `(${value.length} chars)`);
    return SecureStore.setItemAsync(key, value);
  },
  clearToken: async (key: string) => {
    console.log('[Clerk cache] clearToken', key);
    return SecureStore.deleteItemAsync(key);
  },
};

function TokenSync() {
  const { getToken, isSignedIn } = useAuth();
  const setToken = useDriverStore((s) => s.setToken);

  // Register Clerk's getToken as the async getter for api.ts — called fresh on
  // every request so tokens are never stale even if the store hasn't refreshed yet.
  useEffect(() => {
    registerTokenGetter(getToken);
  }, []);

  useEffect(() => {
    if (!isSignedIn) { setToken(null); return; }
    getToken().then((t) => {
      if (t) setToken(t);
    }).catch(() => setToken(null));
    const id = setInterval(() => {
      getToken().then((t) => { if (t) setToken(t); }).catch(() => null);
    }, 55_000);
    return () => clearInterval(id);
  }, [isSignedIn]);

  return null;
}

function SocketBridge() {
  const { getToken, isSignedIn } = useAuth();
  // Depend on token so we only connect once the token is actually available in
  // the store, avoiding the race where api.auth.me fires before TokenSync sets it.
  const token = useDriverStore((s) => s.token);
  const setPendingOffer = useDriverStore((s) => s.setPendingOffer);
  const setActiveTrip = useDriverStore((s) => s.setActiveTrip);
  const router = useRouter();
  // Guard: connect once per session; don't reconnect on every token refresh.
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !token) {
      hasConnectedRef.current = false;
      disconnectSocket();
      return;
    }

    if (hasConnectedRef.current) return;
    hasConnectedRef.current = true;

    let cancelled = false;

    // Provision the driver row (token is now valid) before the socket auth fires.
    api.auth.me().catch(() => null).then(() => {
      if (cancelled) return;

      const s = connectSocket(getToken);

      s.on('trip.request', (data: {
        trip_id: string;
        category: string;
        pickup: { lat: number; lng: number; address: string };
        destination: { lat: number; lng: number; address: string };
        fare_cents: number;
        rider_name: string;
      }) => {
        setPendingOffer({
          tripId: data.trip_id,
          category: data.category,
          pickup: data.pickup,
          destination: data.destination,
          fareCents: data.fare_cents,
          riderName: data.rider_name,
          countdownSeconds: 15,
        });
        router.push('/(driver)/request');
      });

      s.on('trip.request.timeout', () => {
        setPendingOffer(null);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, token]);

  return null;
}

function RootLayoutContent() {
  const { activeTheme } = useTheme();
  const colors = useColors();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <TokenSync />
      <SocketBridge />
      <StatusBar style={activeTheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <LocaleProvider>
          <ThemeProvider>
            <RootLayoutContent />
          </ThemeProvider>
        </LocaleProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
