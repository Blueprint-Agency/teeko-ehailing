import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTripStore } from '@teeko/api';
import { Button, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { SearchingIndicator } from '../../components/SearchingIndicator';

export default function FindingDriverScreen() {
  const router = useRouter();
  const status = useTripStore((s) => s.status);
  const cancel = useTripStore((s) => s.cancel);
  const destination = useTripStore((s) => s.destination);
  const pollStatus = useTripStore((s) => s.pollStatus);

  // Set when the rider taps Cancel, so their own cancellation goes straight home
  // instead of surfacing the "no drivers" screen.
  const manualCancelRef = useRef(false);

  // Fallback for a missed socket event. When no driver is online the backend
  // cancels the trip synchronously — often before the rider's socket has joined
  // its room, so trip.no_drivers never arrives and this screen would otherwise
  // hang on the spinner forever. Poll the active-trip endpoint: a cancelled/gone
  // trip drops out of /active → pollStatus sets status 'cancelled', which surfaces
  // the "no drivers" screen below. Poll once immediately so a dead trip resolves fast.
  useEffect(() => {
    pollStatus();
    const iv = setInterval(() => { pollStatus(); }, 3_000);
    return () => clearInterval(iv);
  }, [pollStatus]);

  useEffect(() => {
    if (status === 'matched') {
      router.replace('/(main)/driver-matched');
    } else if (status === 'idle') {
      router.replace('/(main)/(tabs)');
    } else if (status === 'cancelled' && manualCancelRef.current) {
      router.replace('/(main)/(tabs)');
    }
  }, [status]);

  const handleCancel = async () => {
    manualCancelRef.current = true;
    await cancel('changedPlans');
    router.replace('/(main)/(tabs)');
  };

  // Show the "no drivers" screen when the search ended without a match: either the
  // trip.no_drivers socket event arrived, or the poll saw the trip cancelled
  // server-side (and it wasn't the rider's own cancel).
  const noDrivers =
    status === 'no_drivers' || (status === 'cancelled' && !manualCancelRef.current);

  if (noDrivers) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface px-8 gap-4">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Text className="text-4xl">😔</Text>
        </View>
        <Text weight="bold" className="text-center text-xl">
          No drivers nearby
        </Text>
        <Text tone="secondary" className="text-center text-sm">
          There are no available drivers for{' '}
          {destination?.name ?? 'your destination'} right now. Try again in a few minutes.
        </Text>
        <View className="mt-2 w-full gap-2">
          <Button label="Try again" onPress={() => router.back()} />
          <Button
            label="Go back home"
            variant="ghost"
            onPress={() => router.replace('/(main)/(tabs)')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-surface gap-6">
      <SearchingIndicator />
      <View className="items-center gap-1">
        <Text weight="bold" className="text-xl">
          Finding your driver
        </Text>
        <Text tone="secondary" className="text-sm">
          Looking for a driver near you…
        </Text>
      </View>
      <Button label="Cancel" variant="ghost" onPress={handleCancel} />
    </SafeAreaView>
  );
}
