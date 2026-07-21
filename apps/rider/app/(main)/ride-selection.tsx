import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

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
  const quotesExpireAt = useTripStore((s) => s.quotesExpireAt);
  const quotesExpired = useTripStore((s) => s.quotesExpired);
  const selectRideType = useTripStore((s) => s.selectRideType);
  const selectPayment = useTripStore((s) => s.selectPayment);
  const book = useTripStore((s) => s.book);
  const setPickup = useTripStore((s) => s.setPickup);
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

  // Quotes are honoured for 5 minutes; past that the backend rejects them with
  // 410. Re-quote when the window lapses (and when the screen regains focus
  // after being backgrounded) so the rider always books a live price.
  useEffect(() => {
    if (!quotesExpireAt) return;

    const refresh = () => {
      if (!quotesExpired()) return;
      setLoading(true);
      quote().finally(() => setLoading(false));
    };

    const msLeft = new Date(quotesExpireAt).getTime() - Date.now();
    const timer = setTimeout(refresh, Math.max(0, msLeft));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotesExpireAt]);

  useEffect(() => {
    if (!paymentMethodId && defaultId) {
      selectPayment(defaultId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultId]);

  // Surge currently resolves per pickup location, so it applies to every ride
  // type at once — one notice above the list rather than repeated per row.
  const surged = fareOptions.some((f) => !!f.surge);
  const selectedMethod = methods.find((m) => m.id === paymentMethodId) ?? null;
  const selectedFare = fareOptions.find((f) => f.rideType === rideType) ?? null;
  const canBook = !!rideType && !!paymentMethodId;

  const handleBook = async () => {
    if (!rider || !canBook) return;
    setBooking(true);
    try {
      // Resolve pickup address if still the placeholder set in confirm-destination
      const currentPickup = useTripStore.getState().pickup;
      if (currentPickup && currentPickup.address === 'Current Location') {
        try {
          const results = await Location.reverseGeocodeAsync({
            latitude: currentPickup.lat,
            longitude: currentPickup.lng,
          });
          const r = results[0];
          if (r) {
            const address = [r.name, r.street, r.city].filter(Boolean).join(', ');
            setPickup({ ...currentPickup, name: address, address });
          }
        } catch {
          // keep placeholder — non-fatal
        }
      }
      await book(rider.id);
      // Sync store pickup with what was booked (address now confirmed by API)
      const bookedTrip = useTripStore.getState().trip;
      if (bookedTrip?.pickup) {
        setPickup(bookedTrip.pickup);
      }
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
          {surged ? (
            <View className="mb-3 flex-row items-start rounded-lg bg-warning-50 px-3 py-2">
              <Icon name="bolt" size={16} color="#B45309" />
              <Text className="ml-1.5 flex-1 text-xs text-warning-700">
                Demand is high right now, so fares are temporarily higher. The price you see is
                the price you pay.
              </Text>
            </View>
          ) : null}
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
