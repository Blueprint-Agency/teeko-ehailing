import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="search" options={{ presentation: 'modal' }} />
      <Stack.Screen name="confirm-destination" />
      <Stack.Screen name="ride-selection" />
      <Stack.Screen name="finding-driver" options={{ gestureEnabled: false }} />
      <Stack.Screen name="driver-matched" options={{ gestureEnabled: false }} />
      <Stack.Screen name="in-trip" options={{ gestureEnabled: false }} />
      <Stack.Screen name="trip-complete" options={{ gestureEnabled: false }} />
      <Stack.Screen name="receipt/[id]" />
      <Stack.Screen name="account/personal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="account/security" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
