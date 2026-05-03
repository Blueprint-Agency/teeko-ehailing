import { useState } from 'react';
import { Keyboard, ScrollView, TouchableWithoutFeedback, View } from 'react-native';

import { useUser } from '@clerk/clerk-expo';
import { ApiError, authApi, useAuthStore, useUIStore } from '@teeko/api';
import { Button, Icon, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

const PASSWORD_MIN = 8;

type Step = 'send' | 'verify';

function PasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      haptic="selection"
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    >
      <Icon name={visible ? 'visibility-off' : 'visibility'} size={20} color="#4B5563" />
    </Pressable>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const rider = useAuthStore((s) => s.rider);
  const pushToast = useUIStore((s) => s.pushToast);

  const email = rider?.email ?? user?.primaryEmailAddress?.emailAddress ?? '';

  const [step, setStep] = useState<Step>('send');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const sendCode = async () => {
    if (!email) {
      pushToast({ kind: 'error', message: 'No email on file.' });
      return;
    }
    setBusy(true);
    try {
      await authApi.sendOtp();
      setStep('verify');
      pushToast({ kind: 'info', message: `Code sent to ${email}` });
    } catch (err) {
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.body) as {
            error: string;
            retryInSeconds?: number;
            providerMessage?: string;
          };
          if (body.error === 'rate_limited') {
            pushToast({ kind: 'info', message: `Try again in ${body.retryInSeconds ?? 60}s` });
          } else if (body.error === 'email_delivery_failed') {
            pushToast({
              kind: 'error',
              message: body.providerMessage ?? 'Email failed to send.',
            });
          } else {
            pushToast({ kind: 'error', message: 'Could not send verification code.' });
          }
        } catch {
          pushToast({ kind: 'error', message: 'Could not send verification code.' });
        }
      } else {
        pushToast({ kind: 'error', message: 'Could not send verification code.' });
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setCodeError(undefined);
    setPasswordError(undefined);

    if (code.trim().length === 0) {
      setCodeError('Enter the code from your email');
      return;
    }
    if (newPassword.length < PASSWORD_MIN) {
      setPasswordError(`Password must be at least ${PASSWORD_MIN} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }
    if (!isLoaded || !user) return;

    setBusy(true);
    try {
      // 1) Verify identity with our backend OTP (Gmail SMTP).
      try {
        await authApi.verifyOtp(code.trim());
      } catch (err) {
        if (err instanceof ApiError) {
          try {
            const body = JSON.parse(err.body) as { error: string };
            if (body.error === 'incorrect' || body.error === 'no_active_code') {
              setCodeError('Invalid or expired code');
            } else if (body.error === 'expired') {
              setCodeError('Code expired — tap resend');
            } else if (body.error === 'too_many_attempts') {
              setCodeError('Too many attempts — tap resend');
            } else {
              setCodeError('Verification failed');
            }
          } catch {
            setCodeError('Verification failed');
          }
        } else {
          setCodeError('Verification failed');
        }
        return;
      }

      // 2) Apply the new password via Clerk (still owns the credential).
      await user.updatePassword({ newPassword, signOutOfOtherSessions: true });
      pushToast({ kind: 'info', message: 'Password updated.' });
      router.back();
    } catch (err) {
      const errCode = (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;
      const message = (err as { errors?: Array<{ message?: string }> })
        .errors?.[0]?.message;
      if (
        errCode === 'form_password_pwned' ||
        errCode === 'form_password_length_too_short' ||
        errCode === 'form_password_validation_failed'
      ) {
        setPasswordError(message ?? 'Password rejected');
      } else {
        pushToast({ kind: 'error', message: message ?? 'Could not update password.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable onPress={() => router.back()} haptic="selection" className="-ml-2 p-2">
          <Icon name="close" size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-2 text-lg">
          Change password
        </Text>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mt-4 gap-4">
            <View>
              <Text tone="secondary" className="mb-1 text-xs">
                Email
              </Text>
              <View className="rounded-lg border border-border bg-muted px-4 py-3">
                <Text>{email || '—'}</Text>
              </View>
            </View>

            {step === 'send' ? (
              <Text tone="secondary" className="text-sm">
                We'll send a verification code to your email. Enter it along with your new
                password to confirm the change.
              </Text>
            ) : (
              <>
                <Input
                  label="Verification code"
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={(v) => {
                    setCode(v);
                    if (codeError) setCodeError(undefined);
                  }}
                  error={codeError}
                />
                <Input
                  label="New password"
                  placeholder={`At least ${PASSWORD_MIN} characters`}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  textContentType="newPassword"
                  value={newPassword}
                  onChangeText={(v) => {
                    setNewPassword(v);
                    if (passwordError) setPasswordError(undefined);
                  }}
                  error={passwordError}
                  trailingAdornment={
                    <PasswordToggle visible={showNew} onToggle={() => setShowNew((v) => !v)} />
                  }
                />
                <Input
                  label="Confirm new password"
                  placeholder="Re-enter password"
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  textContentType="newPassword"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  trailingAdornment={
                    <PasswordToggle
                      visible={showConfirm}
                      onToggle={() => setShowConfirm((v) => !v)}
                    />
                  }
                />
                <Pressable onPress={sendCode} haptic="selection" hitSlop={8}>
                  <Text weight="bold" tone="brand" className="text-sm">
                    Resend code
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      <View className="pb-safe pt-2">
        {step === 'send' ? (
          <Button label="Send verification code" onPress={sendCode} loading={busy} disabled={busy} />
        ) : (
          <Button label="Update password" onPress={submit} loading={busy} disabled={busy} />
        )}
      </View>
    </ScreenContainer>
  );
}
