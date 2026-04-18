import { useEffect, useRef } from 'react';
import { BackHandler, View } from 'react-native';

import { useTripStore, useUIStore } from '@teeko/api';
import { Button, type BottomSheetHandle, Pill, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { CallChatButtons } from '../../components/CallChatButtons';
import { CancelTripSheet } from '../../components/CancelTripSheet';
import { DriverCard } from '../../components/DriverCard';
import { MockChatSheet } from '../../components/MockChatSheet';
import { RouteMap } from '../../components/RouteMap';
import { TripStatusHeader } from '../../components/TripStatusHeader';

export default function InTripScreen() {
  const router = useRouter();
  const status = useTripStore((s) => s.status);
  const driver = useTripStore((s) => s.driver);
  const pickup = useTripStore((s) => s.pickup);
  const destination = useTripStore((s) => s.destination);
  const trip = useTripStore((s) => s.trip);
  const driverPosition = useTripStore((s) => s.driverPosition);
  const cancel = useTripStore((s) => s.cancel);
  const pushToast = useUIStore((s) => s.pushToast);

  const chatRef = useRef<BottomSheetHandle>(null);
  const cancelRef = useRef<BottomSheetHandle>(null);
  const toastedStarted = useRef(false);

  useEffect(() => {
    if (status === 'in_trip' && !toastedStarted.current) {
      toastedStarted.current = true;
      pushToast({ kind: 'info', message: 'Your trip has started.' });
    }
  }, [pushToast, status]);

  useEffect(() => {
    if (status === 'completed') {
      router.replace('/(main)/trip-complete');
    } else if (status === 'idle' || status === 'cancelled') {
      router.replace('/(main)/(tabs)');
    }
  }, [router, status]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      cancelRef.current?.present();
      return true;
    });
    return () => sub.remove();
  }, []);

  const confirmCancel = async () => {
    cancelRef.current?.dismiss();
    try {
      await cancel('user');
    } catch {
      // mock handler throws intentionally — status watcher handles navigation
    }
  };

  if (!driver || !pickup || !destination || !trip) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text tone="secondary">Loading trip…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1">
        <RouteMap
          pickup={{ lat: pickup.lat, lng: pickup.lng }}
          destination={{ lat: destination.lat, lng: destination.lng }}
          driverPosition={driverPosition}
        />
        <View className="absolute left-0 right-0 top-12 items-center">
          <Pill size="sm">{`ETA ${trip.fare.etaMin} min`}</Pill>
        </View>
      </View>

      <View className="rounded-t-3xl border-t border-border bg-surface px-gutter pb-8 pt-4 shadow-sm">
        <TripStatusHeader title={`Heading to ${destination.name}`} subtitle={`Arrival in ~${trip.fare.etaMin} min`} />

        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <DriverCard driver={driver} compact />
          </View>
          <CallChatButtons phone={driver.phone} onChat={() => chatRef.current?.present()} />
        </View>

        <View className="mt-4">
          <Button label="Cancel trip" variant="ghost" onPress={() => cancelRef.current?.present()} />
        </View>
      </View>

      <MockChatSheet ref={chatRef} driver={driver} />
      <CancelTripSheet ref={cancelRef} onConfirm={confirmCancel} />
    </View>
  );
}
