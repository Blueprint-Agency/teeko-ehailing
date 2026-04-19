import { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';

import { cn } from '../utils/cn';

export interface SkeletonProps {
  className?: string;
  style?: ViewStyle;
}

export function Skeleton({ className, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ opacity }, style]}
      className={cn('rounded-md bg-muted', className)}
    />
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <View className={cn('flex-row items-center px-gutter py-3', className)}>
      <Skeleton className="h-10 w-10 rounded-full" />
      <View className="ml-3 flex-1">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/3" />
      </View>
    </View>
  );
}
