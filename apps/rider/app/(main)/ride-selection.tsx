import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { routesApi, useAuthStore, usePaymentsStore, useTripStore } from '@teeko/api';
import { formatDistance, formatDuration, useDirections } from '@teeko/maps';
import type { BottomSheetHandle } from '@teeko/ui';
import { Button, Icon, Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { PaymentMethodSheet } from '../../components/PaymentMethodSheet';
import { PaymentSelectorRow } from '../../components/PaymentSelectorRow';
import { RideTypeRow } from '../../components/RideTypeRow';

export default function RideSelectionScreen() {
  const router = useRouter();
  const rider = useAuthStore((s) => s.rider);

  const fareOptions = useTripStore((s) => s.fareOptions);
  const quoteError = useTripStore((s) => s.error);
  const rideType = useTripStore((s) => s.rideType);
  const paymentMethodId = useTripStore((s) => s.paymentMethodId);
  const quote = useTripStore((s) => s.quote);
  const selectRideType = useTripStore((s) => s.selectRideType);
  const selectPayment = useTripStore((s) => s.selectPayment);
  const book = useTripStore((s) => s.book);
  const destination = useTripStore((s) => s.destination);
  const pickup = useTripStore((s) => s.pickup);

  const { result: route } = useDirections({
    origin: pickup,
    destination,
    fetcher: routesApi.fetchDirections,
    options: { mode: 'driving', departureTime: 'now' },
    enabled: !!pickup && !!destination,
  });

  const methods = usePaymentsStore((s) => s.methods);
  const defaultId = usePaymentsStore((s) => s.defaultId);
  const loadPayments = usePaymentsStore((s) => s.load);

  const [loading, setLoading] = useState(fareOptions.length === 0);
  const [booking, setBooking] = useState(false);
  const sheetRef = useRef<BottomSheetHandle>(null);

  useEffect(() => {
    if (fareOptions.length === 0) {
      setLoading(true);
      quote().finally(() => setLoading(false));
    }
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!paymentMethodId && defaultId) {
      selectPayment(defaultId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultId]);

  const selectedMethod = methods.find((m) => m.id === paymentMethodId) ?? null;
  const selectedFare = fareOptions.find((f) => f.rideType === rideType) ?? null;
  const canBook = !!rideType && !!paymentMethodId;

  const handleBook = async () => {
    if (!rider || !canBook) return;
    setBooking(true);
    try {
      await book(rider.id);
      const { status } = useTripStore.getState();
      if (status === 'matched' || status === 'arrived') {
        router.replace('/(main)/driver-matched');
      } else if (status === 'in_trip') {
        router.replace('/(main)/in-trip');
      } else {
        router.replace('/(main)/finding-driver');
      }
    } catch {
      setBooking(false);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="border-b border-border">
        <View className="flex-row items-center px-gutter py-3">
          <Pressable
            onPress={() => router.back()}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <Icon name="arrow-back" size={22} color="#111111" />
          </Pressable>
          <View className="ml-3 flex-1">
            <Text tone="secondary" className="text-xs">
              Going to
            </Text>
            <Text weight="bold" className="text-base" numberOfLines={1}>
              {destination?.name ?? 'Destination'}
            </Text>
            {route ? (
              <Text tone="secondary" className="text-xs">
                {formatDistance(route.distanceMeters)} ·{' '}
                {formatDuration(route.durationInTrafficSeconds ?? route.durationSeconds)}
              </Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#E11D2E" />
          <Text tone="secondary" className="text-sm">
            Getting fares…
          </Text>
        </View>
      ) : quoteError && fareOptions.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text tone="secondary" className="text-center text-sm">
            Could not load fares. Please go back and try again.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Text weight="bold" className="mb-3 text-lg">
            Choose a ride
          </Text>
          <View className="gap-2">
            {fareOptions.map((fare) => (
              <RideTypeRow
                key={fare.rideType}
                fare={fare}
                selected={fare.rideType === rideType}
                onPress={selectRideType}
              />
            ))}
          </View>

          <Text weight="bold" className="mb-3 mt-6 text-base">
            Payment
          </Text>
          <PaymentSelectorRow
            method={selectedMethod}
            onPress={() => sheetRef.current?.present()}
          />

          <View className="mt-6">
            <Button
              label={
                booking
                  ? 'Booking…'
                  : selectedFare
                    ? `Book · RM ${selectedFare.amountMyr.toFixed(2)}`
                    : 'Select a ride'
              }
              onPress={handleBook}
              disabled={!canBook || booking}
            />
          </View>
        </ScrollView>
      )}

      <PaymentMethodSheet
        ref={sheetRef}
        methods={methods}
        selectedId={paymentMethodId}
        onSelect={(id) => {
          selectPayment(id);
          sheetRef.current?.dismiss();
        }}
      />
    </View>
  );
}
