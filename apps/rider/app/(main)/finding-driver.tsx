import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { useAuthStore, useTripStore, useUIStore } from '@teeko/api';
import { Button, Icon, Text } from '@teeko/ui';
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

  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === 'matched' || status === 'arrived') {
      router.replace('/(main)/driver-matched');
    } else if (status === 'idle' || status === 'cancelled') {
      router.replace('/(main)/(tabs)');
    }
  }, [router, status]);

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
    try {
      await cancel('user');
    } catch {
      // mock handler throws intentionally — status watcher handles navigation
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-gutter">
        {showNoDrivers ? (
          <NoDriversState onTryAgain={tryAgain} onCancel={cancelBooking} />
        ) : (
          <SearchingState
            onCancel={cancelBooking}
            pickupName={pickup?.name}
            destinationName={destination?.name}
          />
        )}
      </View>
    </View>
  );
}

function SearchingState({
  onCancel,
  pickupName,
  destinationName,
}: {
  onCancel: () => void;
  pickupName?: string;
  destinationName?: string;
}) {
  return (
    <View className="w-full max-w-sm items-center">
      <SearchingIndicator />
      <Text weight="bold" className="mt-8 text-center text-[28px] leading-tight text-ink-primary">
        Finding your driver
      </Text>
      <Text tone="secondary" className="mt-2 text-center text-sm">
        Matching you with a nearby Teeko driver…
      </Text>

      {(pickupName || destinationName) ? (
        <View className="mt-8 w-full rounded-2xl border border-border bg-surface px-4 py-4">
          {pickupName ? (
            <View className="flex-row items-center">
              <View className="h-2.5 w-2.5 rounded-full bg-ink-primary" />
              <Text className="ml-3 flex-1 text-sm text-ink-primary" numberOfLines={1}>
                {pickupName}
              </Text>
            </View>
          ) : null}
          {pickupName && destinationName ? (
            <View className="ml-[4px] mt-1 mb-1 h-4 w-0.5 bg-ink-primary/30" />
          ) : null}
          {destinationName ? (
            <View className="flex-row items-center">
              <View className="h-2.5 w-2.5 items-center justify-center rounded-sm bg-primary">
                <Icon name="flag" size={8} color="#FFFFFF" />
              </View>
              <Text className="ml-3 flex-1 text-sm text-ink-primary" numberOfLines={1}>
                {destinationName}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="mt-8 w-full">
        <Button label="Cancel request" variant="ghost" onPress={onCancel} />
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
    <View className="w-full max-w-sm rounded-2xl bg-surface p-6">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-50">
        <Icon name="error-outline" size={28} color="#E11D2E" />
      </View>
      <Text weight="bold" className="mt-4 text-xl">
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
