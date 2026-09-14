import { useAuthStore } from '@teeko/api';
import { Redirect, Stack, usePathname } from 'expo-router';

export default function MainLayout() {
  const rider = useAuthStore((s) => s.rider);
  const pathname = usePathname();

  // R6 gate. A rider with no number cannot reach the tabs: the driver's in-trip
  // `tel:` link would have nothing to dial, which silently degrades the ride
  // rather than failing loudly. Legacy accounts and interrupted sign-ups both
  // land here.
  //
  // Keyed off the profile rather than a flag, so it clears the moment
  // add-phone's `fetchProfile()` comes back with a number. `rider === null`
  // means "not loaded yet", not "no phone" — redirecting then would flash the
  // gate at every cold start.
  const needsPhone = !!rider && !rider.phone;
  if (needsPhone && pathname !== '/add-phone') {
    return <Redirect href={"/(main)/add-phone" as never} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      {/* No gestures, no header: the gate is not dismissible. */}
      <Stack.Screen
        name="add-phone"
        options={{ gestureEnabled: false, headerShown: false }}
      />
      <Stack.Screen name="search" options={{ presentation: 'modal' }} />
      <Stack.Screen name="confirm-destination" />
      <Stack.Screen name="ride-selection" />
      <Stack.Screen name="finding-driver" options={{ gestureEnabled: false }} />
      <Stack.Screen name="driver-matched" options={{ gestureEnabled: false }} />
      <Stack.Screen name="in-trip" options={{ gestureEnabled: false }} />
      <Stack.Screen name="trip-complete" options={{ gestureEnabled: false }} />
      <Stack.Screen name="receipt/[id]" />
      <Stack.Screen name="ride-history" />
      <Stack.Screen name="account/personal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="account/phone-change" options={{ presentation: 'modal' }} />
      <Stack.Screen name="account/security" options={{ presentation: 'modal' }} />
      <Stack.Screen name="account/change-password" options={{ presentation: 'modal' }} />
      <Stack.Screen name="account/payments" options={{ presentation: 'modal' }} />
      <Stack.Screen name="account/disputes" />
      <Stack.Screen name="account/support" />
      <Stack.Screen name="account/add-card" options={{ presentation: 'modal' }} />
      <Stack.Screen name="account/demo" options={{ presentation: 'modal' }} />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
