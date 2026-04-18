import { Image, View } from 'react-native';

import type { Driver } from '@teeko/shared';
import { Icon, Text } from '@teeko/ui';

export interface DriverCardProps {
  driver: Driver;
  compact?: boolean;
}

export function DriverCard({ driver, compact }: DriverCardProps) {
  const vehicleLine = `${driver.vehicle.colour} ${driver.vehicle.model}`;
  const photoSize = compact ? 40 : 48;

  return (
    <View className="flex-row items-center">
      <Image
        source={{ uri: driver.photoUrl }}
        style={{ width: photoSize, height: photoSize, borderRadius: photoSize / 2 }}
      />
      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          <Text
            weight="bold"
            className="text-base text-ink-primary flex-shrink"
            numberOfLines={1}
          >
            {driver.name}
          </Text>
          <View className="ml-2 flex-row items-center">
            <Icon name="star" size={13} color="#F5A524" />
            <Text className="ml-0.5 text-xs text-ink-secondary">
              {driver.rating.toFixed(2)}
            </Text>
          </View>
        </View>
        <View className="mt-0.5 flex-row items-center">
          <Text
            tone="secondary"
            className="text-sm flex-shrink"
            numberOfLines={1}
          >
            {vehicleLine}
          </Text>
          <View className="ml-2 rounded-md bg-muted px-2 py-0.5">
            <Text weight="bold" className="text-xs tracking-wide">
              {driver.plate}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
