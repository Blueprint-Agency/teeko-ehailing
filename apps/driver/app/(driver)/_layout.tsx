import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';

import { api } from '../../lib/api';
import AddPhoneScreen from './add-phone';

export default function DriverStackLayout() {
  // R6 gate. Every authenticated driver screen sits under this layout, so this
  // is the one place that can guarantee a driver with no number never reaches
  // the tabs — a rider's in-trip call button would have nothing to dial.
  //
  // Rendered in place of the stack rather than pushed as a route: a route can
  // be dismissed by a back gesture or a deep link, and this one must not be.
  const [needsPhone, setNeedsPhone] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setNeedsPhone(!me.user.phone);
    } catch {
      // A failed read is not proof of a missing number. Let the driver through
      // rather than locking them out of the app over a flaky network — the
      // server still refuses every phone-less operation that matters.
      setNeedsPhone(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  // `null` is "not known yet" — rendering the gate then would flash it at every
  // cold start for drivers who have a number.
  if (needsPhone) return <AddPhoneScreen onSaved={check} />;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="request" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="trip" options={{ animation: 'fade' }} />
      <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="support" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="payouts" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="account/personal" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="account/change-password" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
