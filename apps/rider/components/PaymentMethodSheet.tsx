import { forwardRef } from 'react';
import { View } from 'react-native';

import type { PaymentMethod } from '@teeko/shared';
import { BottomSheet, type BottomSheetHandle, Icon, type IconName, Pressable, Text } from '@teeko/ui';

const kindIcon: Record<PaymentMethod['kind'], IconName> = {
  card: 'credit-card',
  tng: 'account-balance-wallet',
  grabpay: 'account-balance-wallet',
  googlepay: 'account-balance-wallet',
  cash: 'payments',
};

export interface PaymentMethodSheetProps {
  methods: PaymentMethod[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const PaymentMethodSheet = forwardRef<BottomSheetHandle, PaymentMethodSheetProps>(
  function PaymentMethodSheet({ methods, selectedId, onSelect }, ref) {
    return (
      <BottomSheet ref={ref} snapPoints={['55%']}>
        <View className="pb-4">
          <Text weight="bold" className="mb-4 text-xl">
            Payment method
          </Text>
          {methods.map((m) => {
            const active = m.id === selectedId;
            return (
              <Pressable
                key={m.id}
                onPress={() => onSelect(m.id)}
                haptic="selection"
                className="flex-row items-center border-b border-border py-4 active:opacity-90"
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon name={kindIcon[m.kind]} size={20} color="#111111" />
                </View>
                <View className="ml-3 flex-1">
                  <Text weight="medium" className="text-sm">
                    {m.label}
                  </Text>
                  {m.last4 ? (
                    <Text tone="secondary" className="text-xs">
                      •••• {m.last4}
                    </Text>
                  ) : null}
                </View>
                {active ? <Icon name="check" size={22} color="#E11D2E" /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    );
  },
);
