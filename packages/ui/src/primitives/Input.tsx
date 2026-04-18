import { forwardRef, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '../utils/cn';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'className'> {
  label?: string;
  error?: string;
  leadingIcon?: IconName;
  /** Arbitrary leading adornment (e.g. a `+60` country-code chip). Overrides leadingIcon. */
  leadingAdornment?: ReactNode;
  className?: string;
  /** Applied to the inner TextInput. */
  inputClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    leadingIcon,
    leadingAdornment,
    className,
    inputClassName,
    placeholderTextColor = '#9CA3AF',
    ...rest
  },
  ref,
) {
  const hasError = Boolean(error);
  return (
    <View className={cn('w-full', className)}>
      {label ? (
        <Text weight="medium" tone="secondary" className="mb-2 text-sm">
          {label}
        </Text>
      ) : null}
      <View
        className={cn(
          'h-14 flex-row items-center rounded-lg border bg-muted px-4',
          hasError ? 'border-danger' : 'border-border',
        )}
      >
        {leadingAdornment ? (
          <View className="mr-3">{leadingAdornment}</View>
        ) : leadingIcon ? (
          <Icon name={leadingIcon} size={20} color="#4B5563" className="mr-3" />
        ) : null}
        <TextInput
          ref={ref}
          {...rest}
          placeholderTextColor={placeholderTextColor}
          className={cn('flex-1 text-base font-body text-ink-primary', inputClassName)}
        />
      </View>
      {hasError ? (
        <Text tone="danger" className="mt-1 text-xs">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
