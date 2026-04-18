import '@expo/metro-runtime';
import '../global.css';

import { useEffect } from 'react';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from '@expo-google-fonts/nunito';
import type { Locale } from '@teeko/shared';
import { useAuthStore, useLocationStore } from '@teeko/api';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Localization from 'expo-localization';
import * as Location from 'expo-location';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const SUPPORTED: Locale[] = ['en', 'ms', 'zh', 'ta'];

function detectLocale(): Locale {
  const device = Localization.getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED as string[]).includes(device) ? (device as Locale) : 'en';
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  const hydrate = useAuthStore((s) => s.hydrate);
  const setLanguage = useAuthStore((s) => s.setLanguage);
  const setPermission = useLocationStore((s) => s.setPermission);
  const setCurrent = useLocationStore((s) => s.setCurrent);

  useEffect(() => {
    setLanguage(detectLocale());
    hydrate();
  }, [hydrate, setLanguage]);

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
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
