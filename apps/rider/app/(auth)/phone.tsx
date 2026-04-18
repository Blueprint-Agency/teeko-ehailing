import { useState } from 'react';
import { Linking, View } from 'react-native';

import { useAuthStore, useUIStore } from '@teeko/api';
import { Button, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

// PRD §4.1 Sign-Up / Login — phone entry step.
// Continue enables at 9–10 digits after the +60 country code (plan §6).

export default function PhoneScreen() {
  const router = useRouter();
  const startLogin = useAuthStore((s) => s.startLogin);
  const pushToast = useUIStore((s) => s.pushToast);

  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const digits = phone.replace(/\D/g, '');
  const valid = digits.length >= 9 && digits.length <= 10;

  const handleContinue = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await startLogin(`+60${digits}`);
      router.push('/(auth)/otp');
    } catch {
      pushToast({ kind: 'error', message: 'Something went wrong. Try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View className="flex-1 justify-between pb-6 pt-8">
        <View>
          <View className="mb-10 items-center">
            <Text weight="bold" tone="brand" className="text-4xl">
              Teeko
            </Text>
          </View>

          <Text weight="bold" className="text-3xl leading-tight">
            Travel Easily{'\n'}with Teeko.
          </Text>
          <Text tone="secondary" className="mt-3 text-base">
            Enter your phone number to get started. We'll text a code to verify it.
          </Text>

          <View className="mt-10">
            <Input
              label="Phone number"
              value={formatPhone(digits)}
              onChangeText={(t) => {
                setPhone(t);
                if (error) setError(undefined);
              }}
              placeholder="12 345 6789"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              error={error}
              leadingAdornment={
                <View className="flex-row items-center border-r border-border pr-3">
                  <Text weight="medium" className="text-base">
                    +60
                  </Text>
                </View>
              }
            />
          </View>
        </View>

        <View>
          <Button
            label="Continue"
            onPress={handleContinue}
            disabled={!valid}
            loading={submitting}
          />
          <View className="mt-4 flex-row flex-wrap items-center justify-center">
            <Text tone="secondary" className="text-xs">
              By continuing, you agree to Teeko's{' '}
            </Text>
            <Pressable onPress={() => Linking.openURL('https://teeko.my/terms')} haptic="selection">
              <Text weight="medium" tone="brand" className="text-xs">
                Terms
              </Text>
            </Pressable>
            <Text tone="secondary" className="text-xs">
              {' '}and{' '}
            </Text>
            <Pressable
              onPress={() => Linking.openURL('https://teeko.my/privacy')}
              haptic="selection"
            >
              <Text weight="medium" tone="brand" className="text-xs">
                Privacy Policy
              </Text>
            </Pressable>
            <Text tone="secondary" className="text-xs">
              .
            </Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

function formatPhone(digits: string) {
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 10)}`.trim();
}
