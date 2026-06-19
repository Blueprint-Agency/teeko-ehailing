import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useAuthStore } from '@teeko/api';

export default function SplashGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const rider = useAuthStore((s) => s.rider);

  if (!isLoaded) return <View className="flex-1 bg-surface" />;
  if (!isSignedIn) return <Redirect href="/(auth)/signup" />;
  // Signed in — wait for ClerkBridge to populate the profile.
  if (!rider) return <View className="flex-1 bg-surface" />;
  if (!rider.verified) return <Redirect href="/(auth)/verify-email" />;
  return <Redirect href="/(main)/(tabs)" />;
}
