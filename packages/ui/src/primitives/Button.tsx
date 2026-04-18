import { ActivityIndicator, View } from 'react-native';

import { cn } from '../utils/cn';
import { Icon, type IconName } from './Icon';
import { Pressable, type PressableProps } from './Pressable';
import { Text } from './Text';

type Variant = 'primary' | 'ghost' | 'text';
type Size = 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  /** Stretch to container width. Default true. */
  fullWidth?: boolean;
  loading?: boolean;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
}

const base =
  'flex-row items-center justify-center active:opacity-90';

const sizeClass: Record<Size, string> = {
  md: 'h-12 px-4 rounded-full',
  lg: 'h-14 px-5 rounded-full',
};

const variantClass: Record<Variant, string> = {
  primary: 'bg-primary',
  ghost: 'bg-surface border border-border',
  text: 'bg-transparent',
};

const variantText: Record<Variant, 'brand' | 'primary'> = {
  primary: 'primary', // uses text-ink-primary? No — needs white on red
  ghost: 'primary',
  text: 'brand',
};

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  fullWidth = true,
  loading,
  disabled,
  leadingIcon,
  trailingIcon,
  className,
  haptic = 'light',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const bg = variantClass[variant];
  const labelColor =
    variant === 'primary' ? 'text-white' : variant === 'ghost' ? 'text-ink-primary' : 'text-primary';

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      haptic={haptic}
      className={cn(
        base,
        sizeClass[size],
        bg,
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : '#111111'} />
      ) : (
        <View className="flex-row items-center gap-2">
          {leadingIcon ? (
            <Icon
              name={leadingIcon}
              size={20}
              color={variant === 'primary' ? '#FFFFFF' : '#111111'}
            />
          ) : null}
          <Text weight="bold" className={cn('text-base', labelColor)}>
            {label}
          </Text>
          {trailingIcon ? (
            <Icon
              name={trailingIcon}
              size={20}
              color={variant === 'primary' ? '#FFFFFF' : '#111111'}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}
