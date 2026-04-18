import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';

import {
  useAuthStore,
  usePaymentsStore,
  useTripStore,
  useUIStore,
} from '@teeko/api';
import type { RideCategory } from '@teeko/shared';
import {
  type BottomSheetHandle,
  Button,
  Icon,
  Pressable,
  ScreenContainer,
  Text,
} from '@teeko/ui';
import { useRouter } from 'expo-router';

import { PaymentMethodSheet } from '../../components/PaymentMethodSheet';
import { PaymentSelectorRow } from '../../components/PaymentSelectorRow';
import { RideTypeRow } from '../../components/RideTypeRow';
import { RouteMap } from '../../components/RouteMap';

const RIDE_LABELS: Record<RideCategory, string> = {
  go: 'Teeko Go',
  comfort: 'Teeko Comfort',
  xl: 'Teeko XL',
  premium: 'Teeko Premium',
  bike: 'Teeko Bike',
};

export default function RideSelectionScreen() {
  const router = useRouter();
  const rider = useAuthStore((s) => s.rider);
  const pushToast = useUIStore((s) => s.pushToast);

  const pickup = useTripStore((s) => s.pickup);
  const destination = useTripStore((s) => s.destination);
  const fareOptions = useTripStore((s) => s.fareOptions);
  const rideType = useTripStore((s) => s.rideType);
  const paymentMethodId = useTripStore((s) => s.paymentMethodId);
  const quote = useTripStore((s) => s.quote);
  const selectRideType = useTripStore((s) => s.selectRideType);
  const selectPayment = useTripStore((s) => s.selectPayment);
  const book = useTripStore((s) => s.book);

  const methods = usePaymentsStore((s) => s.methods);
  const defaultId = usePaymentsStore((s) => s.defaultId);
  const loadMethods = usePaymentsStore((s) => s.load);

  const sheetRef = useRef<BottomSheetHandle>(null);

  useEffect(() => {
    loadMethods();
    quote();
  }, [loadMethods, quote]);

  // Preselect Go + default payment once data arrives.
  useEffect(() => {
    if (!rideType && fareOptions.length > 0) selectRideType(fareOptions[0]!.rideType);
  }, [fareOptions, rideType, selectRideType]);

  useEffect(() => {
    if (!paymentMethodId && defaultId) selectPayment(defaultId);
  }, [defaultId, paymentMethodId, selectPayment]);

  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === paymentMethodId) ?? null,
    [methods, paymentMethodId],
  );

  const confirm = async () => {
    if (!rider) {
      pushToast({ kind: 'error', message: 'Please sign in again.' });
      return;
    }
    if (!rideType || !paymentMethodId) return;
    router.push('/(main)/finding-driver');
    // Fire after navigation so state transitions run with finding-driver mounted.
    book(rider.id);
  };

  if (!pickup || !destination) {
    return (
      <ScreenContainer>
        <Text weight="bold" className="text-xl">Pick a destination first</Text>
        <View className="mt-4">
          <Button label="Back to Home" onPress={() => router.replace('/(main)/(tabs)')} />
        </View>
      </ScreenContainer>
    );
  }

  const ctaLabel = rideType ? `Select ${RIDE_LABELS[rideType]}` : 'Select ride';

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']} gutter={false}>
      <View className="flex-row items-center gap-3 border-b border-border bg-surface px-gutter py-3">
        <Pressable onPress={() => router.back()} haptic="selection" className="-ml-1 p-1">
          <Icon name="close" size={24} color="#111111" />
        </Pressable>
        <View className="flex-1">
          <Text tone="secondary" numberOfLines={1} className="text-xs">
            From {pickup.name}
          </Text>
          <Text weight="medium" numberOfLines={1} className="text-sm">
            To {destination.name}
          </Text>
        </View>
        <Pressable disabled haptic="none" className="opacity-40 p-1">
          <Icon name="add" size={22} color="#111111" />
        </Pressable>
      </View>

      <View className="h-56">
        <RouteMap pickup={pickup} destination={destination} />
      </View>

      <ScrollView
        className="flex-1 bg-surface"
        contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text weight="bold" className="mb-3 text-base">
          Choose a ride
        </Text>
        <View className="gap-2">
          {fareOptions.map((f) => (
            <RideTypeRow
              key={f.rideType}
              fare={f}
              selected={rideType === f.rideType}
              onPress={selectRideType}
            />
          ))}
        </View>

        <Text weight="bold" className="mb-2 mt-6 text-base">
          Payment
        </Text>
        <PaymentSelectorRow method={selectedMethod} onPress={() => sheetRef.current?.present()} />
      </ScrollView>

      <View className="border-t border-border bg-surface px-gutter py-4">
        <Button
          label={ctaLabel}
          onPress={confirm}
          disabled={!rideType || !paymentMethodId || fareOptions.length === 0}
        />
      </View>

      <PaymentMethodSheet
        ref={sheetRef}
        methods={methods}
        selectedId={paymentMethodId}
        onSelect={(id) => {
          selectPayment(id);
          sheetRef.current?.dismiss();
        }}
      />
    </ScreenContainer>
  );
}
