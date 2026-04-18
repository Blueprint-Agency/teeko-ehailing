import { View } from 'react-native';

import { Icon, Pressable, Text } from '@teeko/ui';

export interface WhereToBarProps {
  onPress: () => void;
  placeholder?: string;
}

export function WhereToBar({ onPress, placeholder = 'Where to?' }: WhereToBarProps) {
  return (
    <Pressable
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={placeholder}
      className="flex-row items-center rounded-full bg-muted px-5 py-4 active:opacity-90"
    >
      <Icon name="search" size={20} color="#4B5563" />
      <View className="ml-3 flex-1">
        <Text tone="secondary" className="text-base">
          {placeholder}
        </Text>
      </View>
    </Pressable>
  );
}
