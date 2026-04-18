import { View } from 'react-native';

import { cn } from '../utils/cn';
import { Icon, type IconName } from './Icon';
import { Pressable, type PressableProps } from './Pressable';
import { Text } from './Text';

export interface ListRowProps extends Omit<PressableProps, 'children'> {
  /** Left-side icon — rendered inside a muted circle chip. */
  leadingIcon?: IconName;
  /** Custom left element overrides `leadingIcon`. */
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Custom right element — e.g. fare, plate pill. Default: chevron_right if `onPress` is set. */
  trailing?: React.ReactNode;
  /** Remove the trailing chevron even if `onPress` is set. */
  noChevron?: boolean;
  /** Hide the bottom divider — useful for the last row in a group. */
  noDivider?: boolean;
}

export function ListRow({
  leadingIcon,
  leading,
  title,
  subtitle,
  trailing,
  noChevron,
  noDivider,
  className,
  onPress,
  ...rest
}: ListRowProps) {
  const showChevron = !noChevron && !!onPress && !trailing;

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      className={cn(
        'flex-row items-center bg-surface px-gutter py-3',
        !noDivider && 'border-b border-border',
        className,
      )}
    >
      {leading ?? (leadingIcon ? (
        <View className="mr-4 h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Icon name={leadingIcon} size={20} color="#4B5563" />
        </View>
      ) : null)}

      <View className="flex-1">
        <Text weight="medium" className="text-base text-ink-primary">
          {title}
        </Text>
        {subtitle ? (
          <Text tone="secondary" className="mt-0.5 text-sm">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}
      {showChevron ? (
        <Icon name="chevron-right" size={20} color="#9CA3AF" />
      ) : null}
    </Pressable>
  );
}
