import { View } from 'react-native';

import type { Trip } from '@teeko/shared';
import { Icon, Pressable, Text } from '@teeko/ui';

export interface RideHistoryRowProps {
  trip: Trip;
  onPress: (trip: Trip) => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} · ${hh}:${mm}`;
}

export function RideHistoryRow({ trip, onPress }: RideHistoryRowProps) {
  const cancelled = trip.status === 'cancelled';
  const ts = trip.completedAt ?? trip.cancelledAt ?? trip.createdAt;
  const fareLabel = cancelled ? 'RM 0' : `RM ${trip.fare.amountMyr.toFixed(2)}`;

  return (
    <Pressable
      onPress={() => onPress(trip)}
      haptic="selection"
      className="flex-row items-start bg-surface px-gutter py-3 border-b border-border"
    >
      <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon
          name="directions-car"
          size={22}
          color={cancelled ? '#9CA3AF' : '#111111'}
        />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center">
          <Text tone="secondary" className="text-xs">
            {formatDateTime(ts)}
          </Text>
          {cancelled ? (
            <View className="ml-2 rounded-full bg-muted px-2 py-0.5">
              <Text className="text-[10px] text-ink-secondary" weight="medium">
                Cancelled
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          weight="medium"
          className="mt-0.5 text-base text-ink-primary"
          numberOfLines={1}
        >
          {trip.pickup.name} → {trip.destination.name}
        </Text>
      </View>

      <Text weight="bold" className="ml-3 text-base">
        {fareLabel}
      </Text>
    </Pressable>
  );
}
