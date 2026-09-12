import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, View } from 'react-native';

import { useUser } from '@clerk/clerk-expo';
import { ApiError, authApi, useAuthStore, useUIStore } from '@teeko/api';
import { cooldownSentence } from '@teeko/shared';
import { Button, Icon, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { PasswordToggle } from '../../../components/PasswordToggle';

const PASSWORD_MIN = 8;

type Step = 'send' | 'verify';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user } = useUser();
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
  // Set when the account has already changed its password in the last 7 days.
  // Locks the screen rather than letting the rider fill a form that cannot post.
  const [cooldown, setCooldown] = useState<string | undefined>();

  const sendCode = async () => {
    if (!email) {
      pushToast({ kind: 'error', message: 'No email on file.' });
      return;
    }
    setBusy(true);
    try {
      // Declaring the purpose lets the server refuse *before* emailing a code
      // the rider could never spend — a password changes once a week.
      await authApi.sendOtp('password_change');
      setStep('verify');
      pushToast({ kind: 'info', message: `Code sent to ${email}` });
    } catch (err) {
      if (err instanceof ApiError) {
        try {
          const body = JSON.parse(err.body) as {
            error: string;
            retryInSeconds?: number;
            nextAllowedAt?: string;
            providerMessage?: string;
          };
          if (body.error === 'password_change_cooldown') {
            const message = body.nextAllowedAt
              ? cooldownSentence('change your password', body.nextAllowedAt)
              : 'You can only change your password once a week.';
            setCooldown(message);
            pushToast({ kind: 'info', message });
          } else if (body.error === 'rate_limited') {
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
    setBusy(true);
    try {
      // One call: the backend verifies the OTP and writes the password through
      // Clerk's admin API. Clerk's client-side user.updatePassword() would
      // demand the current password, which this screen doesn't ask for.
      await authApi.changePassword(code.trim(), newPassword);
      pushToast({ kind: 'info', message: 'Password updated.' });
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        let body: {
          error?: string;
          code?: string;
          message?: string;
          nextAllowedAt?: string;
        } = {};
        try {
          body = JSON.parse(err.body);
        } catch {
          // Non-JSON body — fall through to the generic toast.
        }
        if (body.error === 'password_change_cooldown') {
          // Re-checked server-side: a code minted just before another change
          // landed is still refused here.
          const message = body.nextAllowedAt
            ? cooldownSentence('change your password', body.nextAllowedAt)
            : 'You can only change your password once a week.';
          setCooldown(message);
          pushToast({ kind: 'info', message });
        } else if (body.error === 'incorrect' || body.error === 'no_active_code') {
          setCodeError('Invalid or expired code');
        } else if (body.error === 'expired') {
          setCodeError('Code expired — tap resend');
        } else if (body.error === 'too_many_attempts') {
          setCodeError('Too many attempts — tap resend');
        } else if (body.error === 'password_rejected') {
          // The code is still valid — only the password was refused.
          setPasswordError(
            body.code === 'form_password_pwned'
              ? 'That password has appeared in a data breach'
              : (body.message ?? 'Choose a stronger password'),
          );
        } else {
          pushToast({ kind: 'error', message: 'Could not update password.' });
        }
      } else {
        pushToast({ kind: 'error', message: 'Could not update password.' });
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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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

            {cooldown ? (
              <View className="rounded-lg border border-border bg-muted px-4 py-3">
                <Text weight="bold" className="mb-1 text-sm">
                  Password recently changed
                </Text>
                <Text tone="secondary" className="text-sm">
                  {cooldown}
                </Text>
              </View>
            ) : null}

            {step === 'send' ? (
              <Text tone="secondary" className="text-sm">
                We'll send a verification code to your email. Enter it along with your new
                password to confirm the change. A password can be changed once a week.
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
          <Button
            label="Send verification code"
            onPress={sendCode}
            loading={busy}
            disabled={busy || !!cooldown}
          />
        ) : (
          <Button
            label="Update password"
            onPress={submit}
            loading={busy}
            disabled={busy || !!cooldown}
          />
        )}
      </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
