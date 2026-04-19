import { Platform, View } from 'react-native';

import { Icon, Pressable } from '@teeko/ui';

export interface RecenterButtonProps {
  onPress: () => void;
}

// Floating map control — taps re-fit the map to the route/driver. Sits on top
// of the map; caller positions it absolutely (typically bottom-right, above
// any bottom sheet).
export function RecenterButton({ onPress }: RecenterButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel="Recenter map"
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            },
            android: { elevation: 4 },
          }),
        }}
      >
        <Icon name="my-location" size={22} color="#111111" />
      </View>
    </Pressable>
  );
}
