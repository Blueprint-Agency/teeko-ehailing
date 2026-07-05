import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import type { PaymentMethod } from '@teeko/shared';
import { usePaymentsStore, useUIStore } from '@teeko/api';
import { Button, Icon, type IconName, Pressable, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

const kindIcon: Record<PaymentMethod['kind'], IconName> = {
  card: 'credit-card',
  tng: 'account-balance-wallet',
  google_pay: 'account-balance-wallet',
  cash: 'payments',
};

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const methods = usePaymentsStore((s) => s.methods);
  const defaultId = usePaymentsStore((s) => s.defaultId);
  const load = usePaymentsStore((s) => s.load);
  const setDefault = usePaymentsStore((s) => s.setDefault);
  const remove = usePaymentsStore((s) => s.remove);
  const pushToast = useUIStore((s) => s.pushToast);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load()
      .catch(() => pushToast({ kind: 'error', message: 'Could not load payment methods.' }))
      .finally(() => setLoading(false));
  }, [load, pushToast]);

  const onSetDefault = async (id: string) => {
    if (id === defaultId) return;
    setBusyId(id);
    try {
      await setDefault(id);
    } catch {
      pushToast({ kind: 'error', message: 'Could not set default.' });
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = (m: PaymentMethod) => {
    Alert.alert('Remove payment method', `Remove ${m.label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(m.id);
          try {
            await remove(m.id);
          } catch {
            pushToast({ kind: 'error', message: 'Could not remove method.' });
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

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

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {methods.length === 0 ? (
            <View className="mt-16 items-center gap-2 px-6">
              <Icon name="credit-card" size={40} color="#9CA3AF" />
              <Text tone="secondary" className="text-center text-sm">
                No payment methods yet. Add a card to get started.
              </Text>
            </View>
          ) : (
            <View className="mt-2">
              {methods.map((m) => {
                const isDefault = m.id === defaultId;
                const busy = busyId === m.id;
                return (
                  <View
                    key={m.id}
                    className="flex-row items-center border-b border-border py-4"
                  >
                    <Pressable
                      onPress={() => onSetDefault(m.id)}
                      haptic="selection"
                      disabled={busy}
                      className="flex-1 flex-row items-center active:opacity-90"
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${m.label}${isDefault ? ' (default)' : ''}`}
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Icon name={kindIcon[m.kind]} size={20} color="#111111" />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text weight="medium" className="text-sm">
                          {m.label}
                        </Text>
                        {isDefault ? (
                          <Text className="text-xs text-primary">Default</Text>
                        ) : null}
                      </View>
                      {busy ? (
                        <Spinner size="small" />
                      ) : isDefault ? (
                        <Icon name="check-circle" size={22} color="#E11D2E" />
                      ) : null}
                    </Pressable>
                    <Pressable
                      onPress={() => onDelete(m)}
                      haptic="selection"
                      disabled={busy}
                      className="ml-2 p-2 active:opacity-70"
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${m.label}`}
                    >
                      <Icon name="delete-outline" size={22} color="#9CA3AF" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <View className="gap-3 pb-safe pt-2">
        <Button
          label="Add card"
          onPress={() => router.push('/(main)/account/add-card' as never)}
        />
      </View>
    </ScreenContainer>
  );
}
