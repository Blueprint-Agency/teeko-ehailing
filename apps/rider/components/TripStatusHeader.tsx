import { View } from 'react-native';

import { Text } from '@teeko/ui';

export interface TripStatusHeaderProps {
  title: string;
  subtitle?: string;
}

export function TripStatusHeader({ title, subtitle }: TripStatusHeaderProps) {
  return (
    <View className="mb-3">
      <Text weight="bold" className="text-lg text-ink-primary">
        {title}
      </Text>
      {subtitle ? (
        <Text tone="secondary" className="mt-0.5 text-sm">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
