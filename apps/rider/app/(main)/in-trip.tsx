import { useEffect, useMemo, useRef } from 'react';
import { BackHandler, View } from 'react-native';

import { useTripStore, useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { Button, type BottomSheetHandle, Icon, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { CallChatButtons } from '../../components/CallChatButtons';
import { CancelTripSheet } from '../../components/CancelTripSheet';
import { DriverCard } from '../../components/DriverCard';
import { MockChatSheet } from '../../components/MockChatSheet';
import { RecenterButton } from '../../components/RecenterButton';
import { RouteMap, type RouteMapHandle } from '../../components/RouteMap';
import { TripProgressBar } from '../../components/TripProgressBar';
import { TripStatusHeader } from '../../components/TripStatusHeader';
import { formatDistance, haversineKm } from '../../utils/distance';

export default function InTripScreen() {
  const router = useRouter();
  const t = useT();
  const status = useTripStore((s) => s.status);
  const driver = useTripStore((s) => s.driver);
  const pickup = useTripStore((s) => s.pickup);
  const destination = useTripStore((s) => s.destination);
  const trip = useTripStore((s) => s.trip);
  const driverPosition = useTripStore((s) => s.driverPosition);
  const driverHeading = useTripStore((s) => s.driverHeading);
  const cancel = useTripStore((s) => s.cancel);
  const pushToast = useUIStore((s) => s.pushToast);

  const chatRef = useRef<BottomSheetHandle>(null);
  const cancelRef = useRef<BottomSheetHandle>(null);
  const mapRef = useRef<RouteMapHandle>(null);
  const toastedStarted = useRef(false);

  useEffect(() => {
    if (status === 'in_trip' && !toastedStarted.current) {
      toastedStarted.current = true;
      pushToast({ kind: 'info', message: t('trip.tripStartedToast') });
    }
  }, [pushToast, status, t]);

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

  const confirmCancel = async (reason: string) => {
    cancelRef.current?.dismiss();
    try {
      await cancel(reason);
      pushToast({ kind: 'info', message: t('trip.tripCancelledToast') });
    } catch {
      // mock handler throws intentionally — status watcher handles navigation
    }
  };

  // Estimate trip progress from driver's position between pickup and destination.
  const progress = useMemo(() => {
    if (!pickup || !destination || !driverPosition) return 0;
    const total =
      Math.hypot(destination.lat - pickup.lat, destination.lng - pickup.lng) || 1;
    const travelled = Math.hypot(
      driverPosition.lat - pickup.lat,
      driverPosition.lng - pickup.lng,
    );
    return Math.max(0, Math.min(1, travelled / total));
  }, [pickup, destination, driverPosition]);

  if (!driver || !pickup || !destination || !trip) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text tone="secondary">Loading trip…</Text>
      </View>
    );
  }

  const remainingMin = Math.max(1, Math.round(trip.fare.etaMin * (1 - progress)));
  const distanceToDestKm =
    driverPosition
      ? haversineKm(driverPosition, { lat: destination.lat, lng: destination.lng })
      : null;

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1">
        <RouteMap
          ref={mapRef}
          pickup={{ lat: pickup.lat, lng: pickup.lng }}
          destination={{ lat: destination.lat, lng: destination.lng }}
          driverPosition={driverPosition}
          driverHeading={driverHeading}
          routePolyline={trip.routePolyline}
          phase="intrip"
          topInset={110}
          bottomInset={40}
        />
        <View className="absolute left-0 right-0 top-10 items-center px-gutter">
          <View
            className="w-full max-w-md flex-row items-center rounded-2xl bg-white px-4 py-3"
            style={{ shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
          >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-ink-primary">
              <Icon name="directions-car" size={20} color="#FFFFFF" />
            </View>
            <View className="ml-3 flex-1">
              <Text weight="bold" className="text-sm text-ink-primary">
                ~{remainingMin} min to destination
              </Text>
              <Text tone="secondary" className="text-xs" numberOfLines={1}>
                Heading to {destination.name}
              </Text>
            </View>
          </View>
        </View>
        <View className="absolute bottom-4 right-4">
          <RecenterButton onPress={() => mapRef.current?.recenter()} />
        </View>
      </View>

      <View
        className="rounded-t-3xl border-t border-border bg-surface px-gutter pb-8 pt-4"
        style={{ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8 }}
      >
        <TripStatusHeader title={`Heading to ${destination.name}`} subtitle={`Arrival in ~${remainingMin} min`} />

        <TripProgressBar
          progress={progress}
          phase="intrip"
          leftLabel={`On trip · ${Math.round(progress * 100)}%`}
          rightLabel={formatDistance(distanceToDestKm)}
        />

        <View className="mt-3 flex-row items-center gap-3">
          <View className="flex-1">
            <DriverCard driver={driver} compact />
          </View>
          <CallChatButtons phone={driver.phone} onChat={() => chatRef.current?.present()} />
        </View>

        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Button label="Minimise" variant="ghost" onPress={() => router.push('/(main)/(tabs)' as never)} />
          </View>
          <View className="flex-1">
            <Button label="Cancel trip" variant="ghost" onPress={() => cancelRef.current?.present()} />
          </View>
        </View>
      </View>

      <MockChatSheet ref={chatRef} driver={driver} />
      <CancelTripSheet ref={cancelRef} onConfirm={confirmCancel} />
    </View>
  );
}
