import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { View } from 'react-native';

export default function Root() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <View style={{ flex: 1 }} />;
  if (isSignedIn) return <Redirect href="/(driver)/(tabs)/home" />;
  return <Redirect href="/(auth)/login" />;
}
