import { useEffect, useRef } from 'react';
import { BackHandler, View } from 'react-native';

import { useTripStore, useUIStore } from '@teeko/api';
import { Button, type BottomSheetHandle, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { CallChatButtons } from '../../components/CallChatButtons';
import { CancelTripSheet } from '../../components/CancelTripSheet';
import { DriverCard } from '../../components/DriverCard';
import { MockChatSheet } from '../../components/MockChatSheet';
import { RouteMap } from '../../components/RouteMap';
import { TripStatusHeader } from '../../components/TripStatusHeader';

export default function DriverMatchedScreen() {
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
  const toastedMatched = useRef(false);
  const toastedArrived = useRef(false);

  useEffect(() => {
    if (status === 'matched' && !toastedMatched.current) {
      toastedMatched.current = true;
      pushToast({ kind: 'success', message: 'Driver matched. On the way to you.' });
    }
    if (status === 'arrived' && !toastedArrived.current) {
      toastedArrived.current = true;
      pushToast({ kind: 'info', message: 'Your driver has arrived.' });
    }
  }, [pushToast, status]);

  useEffect(() => {
    if (status === 'in_trip') {
      router.replace('/(main)/in-trip');
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
    await cancel('user');
    router.replace('/(main)/(tabs)');
  };

  if (!driver || !pickup || !destination || !trip) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text tone="secondary">Preparing your trip…</Text>
      </View>
    );
  }

  const isArrived = status === 'arrived';
  const headerTitle = isArrived ? 'Your driver has arrived' : 'Driver is on the way';
  const headerSubtitle = isArrived
    ? `Meet your driver at ${pickup.name}`
    : `Arriving in ${trip.fare.etaMin} min`;

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1">
        <RouteMap
          pickup={{ lat: pickup.lat, lng: pickup.lng }}
          destination={{ lat: destination.lat, lng: destination.lng }}
          driverPosition={driverPosition}
        />
      </View>

      <View className="rounded-t-3xl border-t border-border bg-surface px-gutter pb-8 pt-4 shadow-sm">
        <TripStatusHeader title={headerTitle} subtitle={headerSubtitle} />

        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <DriverCard driver={driver} />
          </View>
          <CallChatButtons phone={driver.phone} onChat={() => chatRef.current?.present()} />
        </View>

        <View className="mt-4">
          <Button label="Cancel trip" variant="ghost" onPress={() => cancelRef.current?.present()} />
        </View>
      </View>

      <MockChatSheet ref={chatRef} driver={driver} />
      <CancelTripSheet
        ref={cancelRef}
        onConfirm={confirmCancel}
        onDismiss={() => cancelRef.current?.dismiss()}
      />
    </View>
  );
}
