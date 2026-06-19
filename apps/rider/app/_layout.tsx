import '@expo/metro-runtime';
import '../global.css';

import { useEffect } from 'react';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/clerk-expo';
import type { Locale } from '@teeko/shared';
import { useAuthStore, useLocationStore, useTripStore, setApiUnauthorizedHandler } from '@teeko/api';
import { initI18n, setLocale } from '@teeko/i18n';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Localization from 'expo-localization';
import * as Location from 'expo-location';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setTokenGetter, tokenCache } from '../lib/clerk';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';

const SUPPORTED: Locale[] = ['en', 'ms', 'zh', 'ta'];

function detectLocale(): Locale {
  const device = Localization.getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED as string[]).includes(device) ? (device as Locale) : 'en';
}

function SocketBridge() {
  const { getToken, isSignedIn } = useAuth();
  const connectTripSocket = useTripStore((s) => s.connectSocket);

  useEffect(() => {
    if (!isSignedIn) {
      disconnectSocket();
      return;
    }
    // Fix 5: Pass the getter function so each reconnect fetches a fresh token.
    const s = connectSocket(getToken);
    connectTripSocket(s);

    return () => {
      disconnectSocket();
    };
  }, [isSignedIn]);

  return null;
}

function ClerkBridge({ children }: { children: React.ReactNode }) {
  const { getToken: clerkGetToken, isSignedIn, signOut } = useAuth();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const clearProfile = useAuthStore((s) => s.clear);
  const restoreActiveTrip = useTripStore((s) => s.restoreActiveTrip);

  useEffect(() => {
    setApiUnauthorizedHandler(() => {
      signOut().finally(() => router.replace('/(auth)/login'));
    });
  }, [signOut]);

  useEffect(() => {
    setTokenGetter(async () => clerkGetToken());

    if (isSignedIn) {
      fetchProfile().catch(() => {
        router.replace('/(auth)/login');
      });
      // Re-hydrate trip store after a refresh so screens like driver-matched
      // don't render blank due to wiped Zustand state.
      restoreActiveTrip().then((clientStatus) => {
        if (clientStatus === 'matched' || clientStatus === 'arrived') {
          router.replace('/(main)/driver-matched');
        } else if (clientStatus === 'in_trip') {
          router.replace('/(main)/in-trip');
        }
      }).catch(() => null);
    } else if (isSignedIn === false) {
      clearProfile();
    }
  }, [isSignedIn, clerkGetToken, fetchProfile, clearProfile]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  const setLanguage = useAuthStore((s) => s.setLanguage);
  const setPermission = useLocationStore((s) => s.setPermission);
  const setCurrent = useLocationStore((s) => s.setCurrent);

  useEffect(() => {
    const locale = detectLocale();
    initI18n(locale);
    setLanguage(locale);
  }, [setLanguage]);

  const languagePref = useAuthStore((s) => s.languagePref);
  useEffect(() => {
    setLocale(languagePref);
  }, [languagePref]);

  // PRD §4.1 + plan §2: request location on first launch, non-blocking.
  // Denial is tolerated — Home falls back to KL Sentral.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setPermission(status === 'granted' ? 'granted' : 'denied');
      if (status === 'granted') {
        try {
          const pos = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
          if (pos && !cancelled && (pos.coords.latitude !== 0 || pos.coords.longitude !== 0)) {
            setCurrent(
              { lat: pos.coords.latitude, lng: pos.coords.longitude },
              pos.coords.heading ?? 0,
            );
          }
        } catch {
          // Ignore — store keeps the default fallback center.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCurrent, setPermission]);

  if (!fontsLoaded) return null;

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <ClerkBridge>
          <SocketBridge />
          <SafeAreaProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(main)" />
              <Stack.Screen name="(auth)" />
            </Stack>
          </SafeAreaProvider>
        </ClerkBridge>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
