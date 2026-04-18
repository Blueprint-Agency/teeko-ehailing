import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { useAuthStore, useLocationStore, useTripStore, useUIStore } from '@teeko/api';
import { Button, Pressable, Text } from '@teeko/ui';
import { MapView } from '@teeko/maps';
import { useRouter } from 'expo-router';

import { SearchingIndicator } from '../../components/SearchingIndicator';

// PRD §4.6: 60s max. Plan §5: show "No drivers available" + Try again on timeout.
const MAX_SEARCH_MS = 60_000;

export default function FindingDriverScreen() {
  const router = useRouter();
  const status = useTripStore((s) => s.status);
  const cancel = useTripStore((s) => s.cancel);
  const book = useTripStore((s) => s.book);
  const pickup = useTripStore((s) => s.pickup);
  const destination = useTripStore((s) => s.destination);
  const rider = useAuthStore((s) => s.rider);
  const forceNoDrivers = useUIStore((s) => s.forceNoDrivers);
  const currentLatLng = useLocationStore((s) => s.current);

  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigate on match — dismiss this screen in favor of driver-matched.
  useEffect(() => {
    if (status === 'matched' || status === 'arrived') {
      router.replace('/(main)/driver-matched');
    }
  }, [router, status]);

  // 60s safety timer.
  useEffect(() => {
    if (status !== 'searching' || timedOut) return;
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true);
      cancel('timeout');
    }, MAX_SEARCH_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [cancel, status, timedOut]);

  const showNoDrivers = timedOut || status === 'no_drivers' || forceNoDrivers;

  const tryAgain = () => {
    if (!rider) return;
    setTimedOut(false);
    book(rider.id);
  };

  const cancelBooking = async () => {
    await cancel('user');
    router.replace('/(main)/(tabs)');
  };

  const centerRegion = {
    latitude: pickup?.lat ?? currentLatLng.lat,
    longitude: pickup?.lng ?? currentLatLng.lng,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View className="flex-1 bg-surface">
      <MapView
        initialRegion={centerRegion}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      />
      {/* Dim overlay */}
      <View pointerEvents="none" className="absolute inset-0 bg-black/40" />

      <View className="absolute inset-0 items-center justify-center px-gutter">
        {showNoDrivers ? (
          <NoDriversState onTryAgain={tryAgain} onCancel={cancelBooking} />
        ) : (
          <SearchingState onCancel={cancelBooking} destinationName={destination?.name} />
        )}
      </View>
    </View>
  );
}

function SearchingState({
  onCancel,
  destinationName,
}: {
  onCancel: () => void;
  destinationName?: string;
}) {
  return (
    <View className="items-center">
      <SearchingIndicator />
      <Text weight="bold" className="mt-8 text-2xl text-white">
        Finding your driver…
      </Text>
      {destinationName ? (
        <Text className="mt-2 text-sm text-white/80">Heading to {destinationName}</Text>
      ) : null}
      <View className="mt-10">
        <Pressable onPress={onCancel} haptic="medium" className="px-6 py-3">
          <Text weight="bold" className="text-base text-white">
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function NoDriversState({
  onTryAgain,
  onCancel,
}: {
  onTryAgain: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="w-full max-w-sm rounded-xl bg-surface p-6">
      <Text weight="bold" className="text-xl">
        No drivers available
      </Text>
      <Text tone="secondary" className="mt-2 text-sm">
        We couldn't find a driver nearby. Please try again in a moment.
      </Text>
      <View className="mt-5 gap-3">
        <Button label="Try again" onPress={onTryAgain} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
