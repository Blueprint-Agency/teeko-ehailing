import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { View } from 'react-native';

export default function SplashGate() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <View className="flex-1 bg-surface" />;
  }
  if (isSignedIn) {
    return <Redirect href="/(main)/(tabs)" />;
  }
  return <Redirect href="/(auth)/signup" />;
}
