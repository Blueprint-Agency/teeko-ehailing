import { Image, View } from 'react-native';

import type { Driver } from '@teeko/shared';
import { Icon, Pill, Text } from '@teeko/ui';

export interface DriverCardProps {
  driver: Driver;
  compact?: boolean;
}

export function DriverCard({ driver, compact }: DriverCardProps) {
  const vehicleLine = `${driver.vehicle.colour} ${driver.vehicle.model}`;
  const photoSize = compact ? 44 : 56;

  return (
    <View className="flex-row items-center">
      <Image
        source={{ uri: driver.photoUrl }}
        style={{ width: photoSize, height: photoSize, borderRadius: photoSize / 2 }}
      />
      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          <Text weight="bold" className="text-base text-ink-primary" numberOfLines={1}>
            {driver.name}
          </Text>
          <View className="ml-2 flex-row items-center">
            <Icon name="star" size={14} color="#F5A524" />
            <Text className="ml-1 text-sm text-ink-secondary">{driver.rating.toFixed(2)}</Text>
          </View>
        </View>
        {!compact ? (
          <Text tone="secondary" className="mt-0.5 text-sm" numberOfLines={1}>
            {vehicleLine}
          </Text>
        ) : null}
      </View>
      <Pill size="sm" className="ml-2">{driver.plate}</Pill>
    </View>
  );
}
