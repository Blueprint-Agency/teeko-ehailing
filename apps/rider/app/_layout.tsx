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
import { useAuthStore, useLocationStore } from '@teeko/api';
import { initI18n, setLocale } from '@teeko/i18n';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Localization from 'expo-localization';
import * as Location from 'expo-location';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setTokenGetter, tokenCache } from '../lib/clerk';

const SUPPORTED: Locale[] = ['en', 'ms', 'zh', 'ta'];

function detectLocale(): Locale {
  const device = Localization.getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED as string[]).includes(device) ? (device as Locale) : 'en';
}

function ClerkBridge({ children }: { children: React.ReactNode }) {
  const { getToken: clerkGetToken, isSignedIn } = useAuth();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const clearProfile = useAuthStore((s) => s.clear);

  useEffect(() => {
    setTokenGetter(async () => clerkGetToken());
  }, [clerkGetToken]);

  useEffect(() => {
    if (isSignedIn) {
      fetchProfile().catch(() => {
        // Surface a generic toast in the future; for now, silent (rider can retry).
      });
    } else if (isSignedIn === false) {
      // Defensive: only clear when explicitly signed-out (not on initial undefined).
      clearProfile();
    }
  }, [isSignedIn, fetchProfile, clearProfile]);

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
          if (pos && !cancelled) {
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
          <SafeAreaProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(main)" />
              <Stack.Screen name="(auth)" options={{ presentation: 'modal', gestureEnabled: true }} />
            </Stack>
          </SafeAreaProvider>
        </ClerkBridge>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
