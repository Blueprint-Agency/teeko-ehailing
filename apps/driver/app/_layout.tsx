import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { ThemeProvider, useTheme } from '../components/ThemeProvider';
import { useColors } from '../constants/colors';
import { LocaleProvider } from '../providers/LocaleProvider';
import { useDriverStore } from '../store/useDriverStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { api } from '../lib/api';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

function TokenSync() {
  const { getToken, isSignedIn } = useAuth();
  const setToken = useDriverStore((s) => s.setToken);

  useEffect(() => {
    if (!isSignedIn) { setToken(null); return; }
    getToken().then((t) => {
      if (t) {
        setToken(t);
        // JIT-provision the driver row on every fresh sign-in (idempotent on backend).
        api.auth.me().catch(() => null);
      }
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
  const setPendingOffer = useDriverStore((s) => s.setPendingOffer);
  const setActiveTrip = useDriverStore((s) => s.setActiveTrip);
  const router = useRouter();

  useEffect(() => {
    if (!isSignedIn) {
      disconnectSocket();
      return;
    }

    let cancelled = false;

    // Ensure the driver row is provisioned before the socket auth fires,
    // otherwise findUserByExternalId returns null and the server disconnects.
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
      const s = getSocket();
      s.off('trip.request');
      s.off('trip.request.timeout');
      disconnectSocket();
    };
  }, [isSignedIn]);

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
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
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
