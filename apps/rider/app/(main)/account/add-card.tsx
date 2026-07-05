import { useState } from 'react';
import { View } from 'react-native';

import { CardField, type CardFieldInput, useStripe } from '@stripe/stripe-react-native';
import { usePaymentsStore, useUIStore } from '@teeko/api';
import { Button, Icon, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

export default function AddCardScreen() {
  const router = useRouter();
  const { createPaymentMethod } = useStripe();
  const add = usePaymentsStore((s) => s.add);
  const pushToast = useUIStore((s) => s.pushToast);

  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      // Card data is read from the native CardField — it never touches our JS
      // (PCI SAQ-A). Returns an unattached pm_xxx; the backend attaches it.
      const { paymentMethod, error } = await createPaymentMethod({
        paymentMethodType: 'Card',
      });
      if (error || !paymentMethod) {
        pushToast({ kind: 'error', message: error?.message ?? 'Could not read card.' });
        return;
      }
      await add('card', paymentMethod.id);
      pushToast({ kind: 'info', message: 'Card added.' });
      router.back();
    } catch {
      pushToast({ kind: 'error', message: 'Could not add card. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable onPress={() => router.back()} haptic="selection" className="-ml-2 p-2">
          <Icon name="close" size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-2 text-lg">
          Add card
        </Text>
      </View>

      <View className="mt-4 flex-1 gap-4">
        <CardField
          postalCodeEnabled={false}
          onCardChange={(card: CardFieldInput.Details) => setComplete(card.complete)}
          style={{ width: '100%', height: 52 }}
          cardStyle={{
            backgroundColor: '#FFFFFF',
            textColor: '#111111',
            borderColor: '#E5E7EB',
            borderWidth: 1,
            borderRadius: 8,
            fontSize: 15,
            placeholderColor: '#9CA3AF',
          }}
        />
        <Text tone="faint" className="text-xs">
          Your card details are encrypted and handled directly by Stripe. Teeko never sees
          your full card number.
        </Text>
      </View>

      <View className="pb-safe pt-2">
        <Button label="Save card" onPress={onSave} loading={saving} disabled={!complete} />
      </View>
    </ScreenContainer>
  );
}
