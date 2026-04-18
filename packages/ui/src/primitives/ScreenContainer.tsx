import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '../utils/cn';

export interface ScreenContainerProps {
  children: ReactNode;
  /** Safe-area edges to respect. Default: all edges. */
  edges?: Edge[];
  /** Override screen background. Default: `bg-surface`. */
  className?: string;
  /** Drop the default 20px horizontal padding. Set to `false` if the screen renders its own full-bleed content (e.g. a map). */
  gutter?: boolean;
}

export function ScreenContainer({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  className,
  gutter = true,
}: ScreenContainerProps) {
  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-surface', className)}>
      <View className={cn('flex-1', gutter && 'px-gutter')}>{children}</View>
    </SafeAreaView>
  );
}
