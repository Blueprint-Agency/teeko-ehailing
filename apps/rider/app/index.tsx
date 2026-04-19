import { useAuthStore } from '@teeko/api';
import { Redirect } from 'expo-router';
import { View } from 'react-native';

export default function SplashGate() {
  const status = useAuthStore((s) => s.status);

  if (status === 'unknown') {
    return <View className="flex-1 bg-surface" />;
  }
  return <Redirect href="/(main)/(tabs)" />;
}
