import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
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
import { connectSocket, disconnectSocket, resumeSocket, getSocket } from '../lib/socket';
import { api, registerTokenGetter } from '../lib/api';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

const tokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  clearToken: (key: string) => SecureStore.deleteItemAsync(key),
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
  const setActiveTripId = useDriverStore((s) => s.setActiveTripId);
  const setActiveTripStatus = useDriverStore((s) => s.setActiveTripStatus);
  const router = useRouter();
  // Guard: connect once per session; don't reconnect on every token refresh.
  const hasConnectedRef = useRef(false);

  // Reconnect on foreground. The OS freezes the JS loop while the app is
  // backgrounded, so the server's ping times out and the socket is dropped
  // without the client noticing — a driver who unlocks their phone would
  // otherwise sit there "online" but unreachable by dispatch until something
  // else happened to re-run the effect below.
  useEffect(() => {
    if (!isSignedIn) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') resumeSocket();
    });
    return () => sub.remove();
  }, [isSignedIn]);

  useEffect(() => {
    // Only a real sign-out tears the socket down. A momentarily null token
    // during a Clerk refresh is not a disconnect reason — treating it as one
    // made the socket drop and reconnect on the TokenSync interval.
    if (!isSignedIn) {
      hasConnectedRef.current = false;
      disconnectSocket();
      return;
    }
    if (!token) return;

    if (hasConnectedRef.current) return;
    hasConnectedRef.current = true;

    let cancelled = false;

    // Provision the driver row (token is now valid) before the socket auth fires.
    api.auth.me().catch(() => null).then(() => {
      if (cancelled) return;

      // Restore active trip state on app restart — fires after token is confirmed
      // valid so the request is authenticated (unlike home screen useEffect which
      // races with TokenSync.registerTokenGetter on mount).
      api.driver.getActiveTrip().then(({ data }) => {
        if (!data || cancelled) return;
        setActiveTripId(data.tripId);
        setActiveTrip(data);
        setActiveTripStatus(data.status);
      }).catch(() => null);

      const s = connectSocket(getToken);

      // Remove any stale listeners from a previous SocketBridge setup run before
      // adding new ones. Without this, if hasConnectedRef resets (token briefly null
      // then non-null), a second listener stacks on the singleton socket and the
      // driver receives two popup navigations for every one trip.request event.
      s.off('trip.request');
      s.off('trip.request.timeout');

      s.on('trip.request', (data: {
        trip_id: string;
        category: string;
        pickup: { lat: number; lng: number; address: string };
        destination: { lat: number; lng: number; address: string };
        fare_cents: number;
        rider_name: string;
        rider_photo_url?: string | null;
      }) => {
        setPendingOffer({
          tripId: data.trip_id,
          category: data.category,
          pickup: data.pickup,
          destination: data.destination,
          fareCents: data.fare_cents,
          riderName: data.rider_name,
          riderPhotoUrl: data.rider_photo_url ?? null,
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
