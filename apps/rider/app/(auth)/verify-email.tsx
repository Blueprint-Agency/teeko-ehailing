import { useState } from 'react';
import { View } from 'react-native';

import { useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { Button, Icon, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useSignUp, useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const t = useT();
  const { signUp, setActive, isLoaded } = useSignUp();
  const clerk = useClerk();
  const pushToast = useUIStore((s) => s.pushToast);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [codeError, setCodeError] = useState<string | undefined>();

  const pendingEmail = signUp?.emailAddress ?? null;

  const onVerify = async () => {
    if (!isLoaded || !signUp || !setActive) return;
    setCodeError(undefined);
    setVerifying(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/(main)/(tabs)');
      } else {
        setCodeError(t('auth.codeIncorrect'));
      }
    } catch (err) {
      const errCode = (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;
      if (errCode === 'form_code_incorrect' || errCode === 'verification_failed') {
        setCodeError(t('auth.codeIncorrect'));
      } else {
        pushToast({ kind: 'error', message: 'Verification failed. Try again.' });
      }
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (!isLoaded || !signUp) return;
    setResending(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      pushToast({ kind: 'info', message: t('auth.resendToast') });
    } finally {
      setResending(false);
    }
  };

  const onClose = async () => {
    try {
      await clerk.signOut();
    } catch {
      // ignore
    }
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

          <View className="mt-8">
            <Input
              label={t('auth.verifyCodeLabel')}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(v) => {
                setCode(v.replace(/\D/g, ''));
                if (codeError) setCodeError(undefined);
              }}
              error={codeError}
            />
          </View>
        </View>

        <View className="gap-3">
          <Button
            label={t('auth.verifyCta')}
            onPress={onVerify}
            loading={verifying}
            disabled={code.length !== 6}
          />
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
