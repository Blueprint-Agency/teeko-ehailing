import { View } from 'react-native';

import { useTripStore } from '@teeko/api';
import { Icon, Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { formatDistance, haversineKm } from '../utils/distance';

export function TripProgressStrip() {
  const router = useRouter();
  const status = useTripStore((s) => s.status);
  const driver = useTripStore((s) => s.driver);
  const trip = useTripStore((s) => s.trip);
  const driverPosition = useTripStore((s) => s.driverPosition);
  const destination = useTripStore((s) => s.destination);

  const active = ['matched', 'arrived', 'in_trip'].includes(status);
  if (!active || !driver || !trip) return null;

  const distanceKm =
    driverPosition && destination
      ? haversineKm(driverPosition, { lat: destination.lat, lng: destination.lng })
      : null;

  const etaLabel =
    status === 'arrived'
      ? 'Arrived'
      : status === 'in_trip'
        ? `${trip.fare.etaMin} min left`
        : `${trip.fare.etaMin} min away`;

  const statusLabel =
    status === 'arrived'
      ? 'Driver has arrived'
      : status === 'in_trip'
        ? 'Trip in progress'
        : 'Driver is on the way';

  const target =
    status === 'in_trip' ? '/(main)/in-trip' : '/(main)/driver-matched';

  return (
    <Pressable
      onPress={() => router.push(target as never)}
      haptic="light"
      className="mx-3 mb-2 flex-row items-center rounded-xl bg-primary px-4 py-2.5 shadow-md"
    >
      <View className="flex-1">
        <Text weight="bold" className="text-sm text-white" numberOfLines={1}>
          {statusLabel} · {driver.name.split(' ')[0]}
        </Text>
        <Text className="mt-0.5 text-xs text-white/80">
          {etaLabel} · {formatDistance(distanceKm)} remaining
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
    </Pressable>
  );
}
