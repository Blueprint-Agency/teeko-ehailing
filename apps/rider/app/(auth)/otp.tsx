import { useEffect, useState } from 'react';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';

import { useAuthStore, useUIStore } from '@teeko/api';
import { Button, OTPInput, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

const RESEND_SECONDS = 30;

// PRD §4.1 — OTP verification. Plan §7: invalid code → red shake + inline error.
// Demo convenience: any 6-digit code starting with "1" succeeds (mock handler).

export default function OtpScreen() {
  const router = useRouter();
  const pendingPhone = useAuthStore((s) => s.pendingPhone);
  const confirmOtp = useAuthStore((s) => s.confirmOtp);
  const startLogin = useAuthStore((s) => s.startLogin);
  const resetChallenge = useAuthStore((s) => s.resetChallenge);
  const pushToast = useUIStore((s) => s.pushToast);

  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const submit = async (value: string) => {
    if (value.length !== 6 || submitting) return;
    setSubmitting(true);
    try {
      await confirmOtp(value);
      router.replace('/(main)/(tabs)');
    } catch {
      setError(true);
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || !pendingPhone) return;
    try {
      await startLogin(pendingPhone);
      setSecondsLeft(RESEND_SECONDS);
      setError(false);
      pushToast({ kind: 'info', message: 'New code sent.' });
    } catch {
      pushToast({ kind: 'error', message: 'Something went wrong. Try again.' });
    }
  };

  const handleChangeNumber = () => {
    resetChallenge();
    router.back();
  };

  return (
    <ScreenContainer>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View className="flex-1 justify-between pb-6 pt-8">
        <View>
          <Text weight="bold" className="text-3xl leading-tight">
            Enter verification{'\n'}code
          </Text>
          <Text tone="secondary" className="mt-3 text-base">
            {pendingPhone ? `We sent a 6-digit code to ${formatDisplayPhone(pendingPhone)}.` : 'We sent a 6-digit code to your phone.'}
          </Text>

          <View className="mt-10">
            <OTPInput
              value={code}
              onChange={(next) => {
                setCode(next);
                if (error) setError(false);
              }}
              onComplete={submit}
              error={error}
              autoFocus
            />
          </View>

          <View className="mt-6 flex-row items-center justify-center">
            {secondsLeft > 0 ? (
              <Text tone="secondary" className="text-sm">
                Resend code in {secondsLeft}s
              </Text>
            ) : (
              <Pressable onPress={handleResend} haptic="light">
                <Text weight="medium" tone="brand" className="text-sm">
                  Resend code
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View>
          <Button
            label="Verify"
            onPress={() => submit(code)}
            disabled={code.length !== 6}
            loading={submitting}
          />
          <View className="mt-4 items-center">
            <Pressable onPress={handleChangeNumber} haptic="selection">
              <Text weight="medium" tone="secondary" className="text-sm">
                Change number
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      </TouchableWithoutFeedback>
    </ScreenContainer>
  );
}

function formatDisplayPhone(e164: string) {
  const digits = e164.replace(/\D/g, '');
  if (!digits.startsWith('60')) return e164;
  const local = digits.slice(2);
  if (local.length <= 2) return `+60 ${local}`;
  if (local.length <= 5) return `+60 ${local.slice(0, 2)} ${local.slice(2)}`;
  return `+60 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}
