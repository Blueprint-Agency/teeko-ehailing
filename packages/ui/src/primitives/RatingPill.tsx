import { View } from 'react-native';

import { cn } from '../utils/cn';
import { Icon } from './Icon';
import { Text } from './Text';

export interface RatingPillProps {
  rating: number;
  /** Render trailing "Rating" label. Used on Account header. */
  showLabel?: boolean;
  className?: string;
}

export function RatingPill({ rating, showLabel, className }: RatingPillProps) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 shadow-sm',
        className,
      )}
    >
      <Icon name="star" size={14} color="#F59E0B" />
      <Text weight="medium" className="text-sm text-ink-primary">
        {rating.toFixed(2)}
      </Text>
      {showLabel ? (
        <Text tone="secondary" className="ml-1 text-xs">
          Rating
        </Text>
      ) : null}
    </View>
  );
}
