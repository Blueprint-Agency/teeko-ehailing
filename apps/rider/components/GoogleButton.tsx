import { View } from 'react-native';

import { Pressable, Text } from '@teeko/ui';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

// Inline Google "G" logomark rendered as stacked arcs (no SVG dep needed for a mockup).
// Kept intentionally simple — recognisable at a glance, not pixel-accurate.
function GoogleMark() {
  return (
    <View className="h-5 w-5 items-center justify-center">
      <Text weight="bold" className="text-base leading-none" style={{ color: '#4285F4' }}>
        G
      </Text>
    </View>
  );
}

export function GoogleButton({ label, onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-14 w-full flex-row items-center justify-center gap-3 rounded-full border border-border bg-surface active:opacity-90"
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <GoogleMark />
      <Text weight="bold" className="text-base text-ink-primary">
        {label}
      </Text>
    </Pressable>
  );
}
