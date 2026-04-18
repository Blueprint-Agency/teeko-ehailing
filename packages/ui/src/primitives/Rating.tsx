import { View } from 'react-native';

import { cn } from '../utils/cn';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

export interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  className?: string;
  readOnly?: boolean;
}

export function Rating({ value, onChange, size = 36, className, readOnly }: RatingProps) {
  return (
    <View className={cn('flex-row items-center justify-center gap-2', className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const onPress = readOnly ? undefined : () => onChange?.(star);
        return (
          <Pressable
            key={star}
            onPress={onPress}
            disabled={readOnly}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel={`Rate ${star} star${star === 1 ? '' : 's'}`}
            className="p-1"
          >
            <Icon name={filled ? 'star' : 'star-border'} size={size} color={filled ? '#F5A524' : '#9CA3AF'} />
          </Pressable>
        );
      })}
    </View>
  );
}
