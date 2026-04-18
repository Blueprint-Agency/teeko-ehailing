import { View } from 'react-native';

import { Icon, Pressable, Text } from '@teeko/ui';

export interface RidesActionCardProps {
  onPress: () => void;
}

export function RidesActionCard({ onPress }: RidesActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel="Book a ride"
      className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-5 py-5 active:opacity-90 shadow-sm"
    >
      <View className="flex-1 pr-3">
        <Text weight="bold" className="text-xl text-ink-primary">
          Rides
        </Text>
        <Text tone="secondary" className="mt-1 text-sm">
          Let's get moving
        </Text>
      </View>
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-50">
        <Icon name="directions-car" size={28} color="#E11D2E" />
      </View>
    </Pressable>
  );
}
