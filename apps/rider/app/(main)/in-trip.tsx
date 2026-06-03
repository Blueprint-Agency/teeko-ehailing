import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTripStore } from '@teeko/api';
import type { BottomSheetHandle } from '@teeko/ui';
import { Icon, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { CallChatButtons } from '../../components/CallChatButtons';
import { CancelTripSheet } from '../../components/CancelTripSheet';
import { DriverCard } from '../../components/DriverCard';
import { MockChatSheet } from '../../components/MockChatSheet';
import { RouteMap, type RouteMapHandle } from '../../components/RouteMap';

export default function InTripScreen() {
  const router = useRouter();
  const status = useTripStore((s) => s.status);
  const driver = useTripStore((s) => s.driver);
  const trip = useTripStore((s) => s.trip);
  const pickup = useTripStore((s) => s.pickup);
  const destination = useTripStore((s) => s.destination);
  const driverPosition = useTripStore((s) => s.driverPosition);
  const driverHeading = useTripStore((s) => s.driverHeading);
  const cancel = useTripStore((s) => s.cancel);

  const cancelSheetRef = useRef<BottomSheetHandle>(null);
  const chatSheetRef = useRef<BottomSheetHandle>(null);
  const mapRef = useRef<RouteMapHandle>(null);

  useEffect(() => {
    if (status === 'completed') {
      router.replace('/(main)/trip-complete');
    } else if (status === 'cancelled' || status === 'idle') {
      router.replace('/(main)/(tabs)');
    }
  }, [status]);

  if (!driver || !pickup || !destination) return null;

  return (
    <View className="flex-1 bg-surface">
      <RouteMap
        ref={mapRef}
        pickup={pickup}
        destination={destination}
        driverPosition={driverPosition}
        driverHeading={driverHeading}
        phase="intrip"
        bottomInset={240}
        topInset={60}
        routePolyline={trip?.routePolyline}
      />

      {/* Status pill */}
      <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0 items-center pt-3">
        <View
          className="flex-row items-center gap-2 rounded-full bg-white px-4 py-2"
          style={{ shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 }}
        >
          <View className="h-2 w-2 rounded-full bg-primary" />
          <Text weight="medium" className="text-sm">
            Trip in progress
          </Text>
        </View>
      </SafeAreaView>

      {/* Bottom card */}
      <SafeAreaView
        edges={['bottom']}
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-border bg-surface"
      >
        <View className="gap-4 px-gutter pb-4 pt-4">
          {/* Destination + fare */}
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-50">
              <Icon name="place" size={18} color="#E11D2E" />
            </View>
            <View className="flex-1">
              <Text tone="secondary" className="text-xs">
                Heading to
              </Text>
              <Text weight="bold" className="text-base" numberOfLines={1}>
                {destination.name}
              </Text>
            </View>
            <Text weight="bold" className="text-base">
              RM {trip?.fare.amountMyr.toFixed(2) ?? '—'}
            </Text>
          </View>

          {/* Driver + call/chat */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <DriverCard driver={driver} compact />
            </View>
            <CallChatButtons
              phone={driver.phone}
              onChat={() => chatSheetRef.current?.present()}
            />
          </View>

          {/* Cancel */}
          <View>
            <View className="mb-3 h-px bg-border" />
            <Text
              onPress={() => cancelSheetRef.current?.present()}
              tone="secondary"
              className="text-center text-sm underline"
            >
              Cancel ride
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <CancelTripSheet
        ref={cancelSheetRef}
        onConfirm={async (reason) => {
          await cancel(reason);
          router.replace('/(main)/(tabs)');
        }}
      />

      <MockChatSheet ref={chatSheetRef} driver={driver} />
    </View>
  );
}
