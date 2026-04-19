import { useState } from 'react';
import { View } from 'react-native';

import { useAuthStore, useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { Button, Icon, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const t = useT();
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  const resendVerification = useAuthStore((s) => s.resendVerification);
  const resetVerification = useAuthStore((s) => s.resetVerification);
  const pushToast = useUIStore((s) => s.pushToast);

  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const onVerify = async () => {
    setVerifying(true);
    try {
      await verifyEmail();
      // Dismiss the entire auth modal stack back to wherever the user was.
      router.dismissAll?.();
      router.back();
    } catch {
      pushToast({ kind: 'error', message: 'Verification failed. Try again.' });
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      await resendVerification();
      pushToast({ kind: 'info', message: t('auth.resendToast') });
    } finally {
      setResending(false);
    }
  };

  const onClose = () => {
    resetVerification();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer>
      <View className="flex-1 justify-between pb-6 pt-8">
        <View>
          <Pressable onPress={onClose} haptic="selection" accessibilityRole="button" className="mb-6 h-10 w-10 items-center justify-center">
            <Icon name="close" size={24} color="#111111" />
          </Pressable>

          <View className="items-center">
            <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Icon name="mail-outline" size={36} color="#E11D2E" />
            </View>
            <Text weight="bold" className="text-center text-3xl leading-tight">
              {t('auth.verifyEmailTitle')}
            </Text>
            <Text tone="secondary" className="mt-3 text-center text-base">
              {t('auth.verifyEmailBody', { email: pendingEmail ?? 'your email' })}
            </Text>
          </View>
        </View>

        <View className="gap-3">
          <Button label={t('auth.verifyCta')} onPress={onVerify} loading={verifying} />
          <Button
            label={t('auth.resend')}
            variant="ghost"
            onPress={onResend}
            loading={resending}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
