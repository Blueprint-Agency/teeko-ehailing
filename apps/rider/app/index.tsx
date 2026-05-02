import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useAuthStore } from '@teeko/api';

export default function SplashGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const rider = useAuthStore((s) => s.rider);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn && !rider && !profileLoading) {
      setProfileLoading(true);
      fetchProfile().finally(() => setProfileLoading(false));
    }
  }, [isSignedIn, rider, profileLoading, fetchProfile]);

  if (!isLoaded) return <View className="flex-1 bg-surface" />;
  if (!isSignedIn) return <Redirect href="/(auth)/signup" />;
  // Signed in — wait for profile to load before deciding.
  if (!rider) return <View className="flex-1 bg-surface" />;
  if (!rider.verified) return <Redirect href="/(auth)/verify-email" />;
  return <Redirect href="/(main)/(tabs)" />;
}
