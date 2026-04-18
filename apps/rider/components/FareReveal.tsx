import { View } from 'react-native';

import { Text } from '@teeko/ui';

export interface FareRevealProps {
  amountMyr: number;
  label?: string;
}

export function FareReveal({ amountMyr, label = 'Total fare' }: FareRevealProps) {
  return (
    <View className="items-center">
      <Text tone="secondary" className="text-sm uppercase tracking-wide">
        {label}
      </Text>
      <Text weight="bold" className="mt-1 text-5xl text-ink-primary">
        RM {amountMyr.toFixed(2)}
      </Text>
    </View>
  );
}
