import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';

import { useAuthStore } from '@teeko/api';
import { useT } from '@teeko/i18n';

import { LoadingScreen } from '../components/LoadingScreen';

export default function SplashGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const rider = useAuthStore((s) => s.rider);
  const t = useT();

  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect href="/(auth)/signup" />;
  // Signed in — wait for ClerkBridge to populate the profile.
  if (!rider) return <LoadingScreen message={t('common.gettingReady')} />;
  if (!rider.verified) return <Redirect href="/(auth)/verify-email" />;
  return <Redirect href="/(main)/(tabs)" />;
}
