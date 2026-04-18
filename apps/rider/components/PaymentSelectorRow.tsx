import { View } from 'react-native';

import type { PaymentMethod } from '@teeko/shared';
import { Icon, type IconName, Pressable, Text } from '@teeko/ui';

export interface PaymentSelectorRowProps {
  method: PaymentMethod | null;
  onPress: () => void;
}

const kindIcon: Record<PaymentMethod['kind'], IconName> = {
  card: 'credit-card',
  tng: 'account-balance-wallet',
  grabpay: 'account-balance-wallet',
  googlepay: 'account-balance-wallet',
  cash: 'payments',
};

export function PaymentSelectorRow({ method, onPress }: PaymentSelectorRowProps) {
  return (
    <Pressable
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel="Change payment method"
      className="flex-row items-center rounded-lg border border-border bg-surface px-4 py-3 active:opacity-90"
    >
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Icon name={method ? kindIcon[method.kind] : 'credit-card'} size={20} color="#111111" />
      </View>
      <View className="ml-3 flex-1">
        <Text weight="medium" className="text-sm">
          {method ? method.label : 'Add payment method'}
        </Text>
        {method?.last4 ? (
          <Text tone="secondary" className="text-xs">
            •••• {method.last4}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={22} color="#9CA3AF" />
    </Pressable>
  );
}
