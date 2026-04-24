import React from 'react';
import { Stack } from 'expo-router';

export default function DriverStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="request" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="trip" options={{ animation: 'fade' }} />
      <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="support" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
