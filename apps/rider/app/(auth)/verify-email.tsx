import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ApiError, authApi, useAuthStore, useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { Button, Icon, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const t = useT();
  const clerk = useClerk();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const rider = useAuthStore((s) => s.rider);
  const pushToast = useUIStore((s) => s.pushToast);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [codeError, setCodeError] = useState<string | undefined>();

  const pendingEmail = rider?.email ?? null;
  const autoSentRef = useRef(false);

  useEffect(() => {
    if (autoSentRef.current) return;
    if (!rider?.email) return;
    autoSentRef.current = true;
    authApi.sendOtp().catch(() => {
      // Silent — user can tap "Resend" if they didn't receive it.
    });
  }, [rider?.email]);

  const onVerify = async () => {
    setCodeError(undefined);
    setVerifying(true);
    try {
      await authApi.verifyOtp(code.trim());
      await fetchProfile();
      router.replace('/(main)/(tabs)');
    } catch (err) {
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.body) as { error: string };
          if (body.error === 'incorrect' || body.error === 'no_active_code') {
            setCodeError(t('auth.codeIncorrect'));
          } else if (body.error === 'expired') {
            pushToast({ kind: 'error', message: 'Code expired. Tap resend.' });
          } else if (body.error === 'too_many_attempts') {
            pushToast({ kind: 'error', message: 'Too many attempts. Tap resend.' });
          } else {
            pushToast({ kind: 'error', message: 'Verification failed. Try again.' });
          }
        } catch {
          pushToast({ kind: 'error', message: 'Verification failed. Try again.' });
        }
      } else {
        pushToast({ kind: 'error', message: 'Verification failed. Try again.' });
      }
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      await authApi.sendOtp();
      pushToast({ kind: 'info', message: t('auth.resendToast') });
    } catch (err) {
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.body) as { error: string; retryInSeconds?: number };
          if (body.error === 'rate_limited') {
            pushToast({ kind: 'info', message: `Try again in ${body.retryInSeconds ?? 60}s` });
          } else if (body.error === 'email_delivery_failed') {
            const provider = body as { providerMessage?: string };
            pushToast({
              kind: 'error',
              message: provider.providerMessage
                ? `Email failed: ${provider.providerMessage}`
                : 'Email failed to send.',
            });
          } else if (body.error === 'no_email_on_account') {
            pushToast({ kind: 'error', message: 'No email on this account.' });
          } else {
            pushToast({ kind: 'error', message: 'Could not resend code.' });
          }
        } catch {
          pushToast({ kind: 'error', message: 'Could not resend code.' });
        }
      } else {
        pushToast({ kind: 'error', message: 'Could not resend code.' });
      }
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
