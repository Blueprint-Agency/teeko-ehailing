import { type ReactNode } from 'react';

import { cn } from '../utils/cn';
import { Pressable, type PressableProps } from './Pressable';
import { Text } from './Text';

export interface PillProps extends Omit<PressableProps, 'children'> {
  children: ReactNode;
  selected?: boolean;
  size?: 'sm' | 'md';
}

export function Pill({ children, selected, size = 'md', className, ...rest }: PillProps) {
  return (
    <Pressable
      {...rest}
      className={cn(
        'flex-row items-center rounded-full border',
        size === 'sm' ? 'h-8 px-3' : 'h-10 px-4',
        selected ? 'border-primary bg-primary-50' : 'border-border bg-surface',
        className,
      )}
    >
      <Text
        weight="medium"
        className={cn(
          size === 'sm' ? 'text-xs' : 'text-sm',
          selected ? 'text-primary' : 'text-ink-primary',
        )}
      >
        {children}
      </Text>
    </Pressable>
  );
}
