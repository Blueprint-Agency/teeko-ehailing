import { View } from 'react-native';

import { Icon, Text } from '@teeko/ui';

export interface TripProgressBarProps {
  /** 0..1 */
  progress: number;
  phase: 'approach' | 'intrip';
  leftLabel?: string;
  rightLabel?: string;
}

export function TripProgressBar({
  progress,
  phase,
  leftLabel,
  rightLabel,
}: TripProgressBarProps) {
  const pct = Math.max(0, Math.min(1, progress));
  const width: `${number}%` = `${Math.round(pct * 100)}%`;
  const fill = phase === 'intrip' ? '#111111' : '#E11D2E';

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="h-2 w-2 rounded-full bg-ink-primary" />
          <Text weight="medium" className="ml-2 text-xs text-ink-primary" numberOfLines={1}>
            {leftLabel ?? (phase === 'intrip' ? 'On trip' : 'On the way')}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text weight="medium" className="mr-2 text-xs text-ink-primary" numberOfLines={1}>
            {rightLabel ?? `${Math.round(pct * 100)}%`}
          </Text>
          <Icon name="flag" size={12} color="#E11D2E" />
        </View>
      </View>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <View
          style={{
            height: '100%',
            width,
            backgroundColor: fill,
            borderRadius: 999,
          }}
        />
      </View>
    </View>
  );
}
