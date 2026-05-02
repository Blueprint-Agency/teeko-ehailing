import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { View } from 'react-native';

export default function SplashGate() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <View className="flex-1 bg-surface" />;
  }
  return <Redirect href="/(main)/(tabs)" />;
}
