import { View, type ViewProps } from 'react-native';

import { cn } from '../utils/cn';

type Variant = 'flat' | 'outlined' | 'raised';

export interface CardProps extends ViewProps {
  variant?: Variant;
  /** Corner radius scale. Default `'lg'` = 16px, `'xl'` = 24px for "hero" cards. */
  radius?: 'lg' | 'xl';
  className?: string;
}

const variantClass: Record<Variant, string> = {
  flat: 'bg-surface',
  outlined: 'bg-surface border border-border',
  raised: 'bg-surface border border-border shadow-sm',
};

export function Card({
  variant = 'outlined',
  radius = 'lg',
  className,
  children,
  ...rest
}: CardProps) {
  const radiusClass = radius === 'xl' ? 'rounded-xl' : 'rounded-lg';
  return (
    <View {...rest} className={cn(variantClass[variant], radiusClass, 'p-4', className)}>
      {children}
    </View>
  );
}
