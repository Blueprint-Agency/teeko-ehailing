import * as Haptics from 'expo-haptics';
import { Pressable as RNPressable, type PressableProps as RNPressableProps } from 'react-native';

export type HapticStyle = 'selection' | 'light' | 'medium' | 'heavy' | 'none';

export interface PressableProps extends RNPressableProps {
  className?: string;
  /** Haptic feedback on press-in. Default: 'selection' for most tap targets. */
  haptic?: HapticStyle;
}

function fire(haptic: HapticStyle) {
  switch (haptic) {
    case 'none':
      return;
    case 'selection':
      Haptics.selectionAsync().catch(() => {});
      return;
    case 'light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    case 'medium':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return;
    case 'heavy':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      return;
  }
}

export function Pressable({ haptic = 'selection', onPressIn, ...rest }: PressableProps) {
  return (
    <RNPressable
      {...rest}
      onPressIn={(e) => {
        fire(haptic);
        onPressIn?.(e);
      }}
    />
  );
}
