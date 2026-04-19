import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import { usePaymentsStore } from '@teeko/api';
import type { PaymentMethod } from '@teeko/shared';
import { Icon, type IconName, Pressable, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

const KIND_ICON: Record<PaymentMethod['kind'], IconName> = {
  card: 'credit-card',
  tng: 'account-balance-wallet',
  grabpay: 'account-balance-wallet',
  googlepay: 'account-balance-wallet',
  cash: 'payments',
};

export default function PaymentsScreen() {
  const router = useRouter();
  const methods = usePaymentsStore((s) => s.methods);
  const defaultId = usePaymentsStore((s) => s.defaultId);
  const load = usePaymentsStore((s) => s.load);
  const setDefault = usePaymentsStore((s) => s.setDefault);

  useEffect(() => {
    if (methods.length === 0) load();
  }, [methods.length, load]);

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable onPress={() => router.back()} haptic="selection" className="-ml-2 p-2">
          <Icon name="close" size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-2 text-lg">
          Payment methods
        </Text>
      </View>

      {methods.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <ScrollView
          className="-mx-gutter"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <View className="mt-4 border-y border-border bg-surface">
            {methods.map((m, i) => {
              const active = m.id === defaultId;
              const last = i === methods.length - 1;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setDefault(m.id)}
                  haptic="selection"
                  className={`flex-row items-center px-gutter py-4 active:opacity-90 ${
                    last ? '' : 'border-b border-border'
                  }`}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon name={KIND_ICON[m.kind]} size={20} color="#111111" />
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
                  {active ? (
                    <View className="flex-row items-center">
                      <Text tone="secondary" className="mr-2 text-xs">
                        Default
                      </Text>
                      <Icon name="check" size={22} color="#E11D2E" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text tone="faint" className="mt-3 px-gutter text-xs">
            Tap a method to set as default. Adding new methods is coming soon.
          </Text>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
