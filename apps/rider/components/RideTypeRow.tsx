import { View } from 'react-native';

import type { Fare, RideCategory } from '@teeko/shared';
import { Icon, type IconName, Pressable, Text } from '@teeko/ui';

import { cn } from '../lib/cn';

export interface RideTypeRowProps {
  fare: Fare;
  selected: boolean;
  onPress: (rideType: RideCategory) => void;
}

const rideMeta: Record<RideCategory, { label: string; icon: IconName; seats: number; sub: string }> = {
  go: { label: 'Teeko Go', icon: 'directions-car', seats: 4, sub: 'Affordable everyday rides' },
  comfort: { label: 'Teeko Comfort', icon: 'directions-car', seats: 4, sub: 'Newer cars, more space' },
  xl: { label: 'Teeko XL', icon: 'airport-shuttle', seats: 6, sub: 'Up to 6 seats' },
  premium: { label: 'Teeko Premium', icon: 'local-taxi', seats: 4, sub: 'High-end vehicles' },
  bike: { label: 'Teeko Bike', icon: 'two-wheeler', seats: 1, sub: 'Fastest for short trips' },
};

export function RideTypeRow({ fare, selected, onPress }: RideTypeRowProps) {
  const m = rideMeta[fare.rideType];
  return (
    <Pressable
      onPress={() => onPress(fare.rideType)}
      haptic="selection"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'flex-row items-center rounded-lg border bg-surface px-4 py-3 active:opacity-90',
        selected ? 'border-primary' : 'border-border',
      )}
    >
      <View
        className={cn(
          'h-12 w-12 items-center justify-center rounded-lg',
          selected ? 'bg-primary-50' : 'bg-muted',
        )}
      >
        <Icon name={m.icon} size={26} color={selected ? '#E11D2E' : '#111111'} />
      </View>
      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          <Text weight="bold" className="text-base">
            {m.label}
          </Text>
          <View className="ml-2 flex-row items-center">
            <Icon name="person" size={12} color="#9CA3AF" />
            <Text tone="faint" className="ml-0.5 text-xs">
              {m.seats}
            </Text>
          </View>
        </View>
        <Text tone="secondary" className="text-xs">
          {fare.etaMin} min away · {m.sub}
        </Text>
      </View>
      <View className="items-end">
        <Text weight="bold" className="text-base">
          RM {fare.amountMyr.toFixed(2)}
        </Text>
      </View>
    </Pressable>
  );
}
