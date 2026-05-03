import { useState } from 'react';
import { Keyboard, ScrollView, TouchableWithoutFeedback, View } from 'react-native';

import { useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { Button, Icon, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

import { GoogleButton } from '../../components/GoogleButton';

const PASSWORD_MIN = 8;

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

export default function SignupScreen() {
  const router = useRouter();
  const t = useT();
  const { signUp, setActive, isLoaded } = useSignUp();
  const pushToast = useUIStore((s) => s.pushToast);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const submit = async () => {
    // Verbose log so we can see in the dev console that the tap registered.
    // Remove once signup is reliable.
    console.log('[signup] submit tapped', {
      hasName: !!name.trim(),
      hasEmail: !!email.trim(),
      passwordLen: password.length,
      confirmLen: confirmPassword.length,
      passwordsMatch: password === confirmPassword,
      isLoaded,
    });

    setEmailError(undefined);
    setPasswordError(undefined);
    setConfirmError(undefined);

    if (!name.trim()) {
      pushToast({ kind: 'error', message: 'Name is required' });
      return;
    }
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setPasswordError(`Password must be at least ${PASSWORD_MIN} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError("Passwords don't match");
      return;
    }
    if (!isLoaded || !signUp || !setActive) {
      pushToast({ kind: 'info', message: 'Still loading — please try again in a moment.' });
      return;
    }

    setSubmitting(true);
    console.log('[signup] calling signUp.create');
    try {
      const attempt = await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: name.trim() || undefined,
      });
      console.log('[signup] signUp.create returned', { status: attempt.status, hasSession: !!attempt.createdSessionId });
      // Clerk dashboard: "Verify at sign-up" must be OFF so create returns
      // status='complete' immediately and gives us a session.
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/(auth)/verify-email');
      } else {
        pushToast({
          kind: 'error',
          message:
            'Sign-up incomplete. Disable "Verify at sign-up" in the Clerk dashboard.',
        });
      }
    } catch (err) {
      console.log('[signup] signUp.create threw', err);
      const code = (err as { errors?: Array<{ code?: string; message?: string }> })
        .errors?.[0]?.code;
      const message = (err as { errors?: Array<{ message?: string }> })
        .errors?.[0]?.message;
      if (code === 'form_identifier_exists') {
        setEmailError('An account with this email already exists');
      } else if (code === 'form_param_format_invalid') {
        setEmailError(t('auth.invalidEmail'));
      } else if (
        code === 'form_password_pwned' ||
        code === 'form_password_length_too_short' ||
        code === 'form_password_size_in_bytes_exceeded' ||
        code === 'form_password_validation_failed'
      ) {
        setPasswordError(message ?? t('auth.invalidPassword'));
      } else {
        pushToast({
          kind: 'error',
          message: message ? `Sign-up failed: ${message}` : 'Sign-up failed. Try again.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={{
            paddingVertical: 24,
            flexGrow: 1,
            justifyContent: 'space-between',
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text weight="bold" className="text-3xl leading-tight">
              {t('auth.signupTitle')}
            </Text>
            <Text tone="secondary" className="mt-2 text-base">
              {t('auth.signupSubtitle')}
            </Text>

            <View className="mt-8 gap-4">
              <Input
                label={t('auth.nameLabel')}
                placeholder="Alex Tan"
                autoCapitalize="words"
                autoComplete="name"
                value={name}
                onChangeText={setName}
              />
              <Input
                label={t('auth.emailLabel')}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (emailError) setEmailError(undefined);
                }}
                error={emailError}
              />
              <Input
                label={t('auth.passwordLabel')}
                placeholder={`At least ${PASSWORD_MIN} characters`}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                textContentType="newPassword"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (passwordError) setPasswordError(undefined);
                  if (confirmError && v === confirmPassword) setConfirmError(undefined);
                }}
                error={passwordError}
                trailingAdornment={
                  <PasswordToggle
                    visible={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                }
              />
              <Input
                label="Confirm password"
                placeholder="Re-enter your password"
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoComplete="password-new"
                textContentType="newPassword"
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (confirmError && v === password) setConfirmError(undefined);
                }}
                error={confirmError}
                trailingAdornment={
                  <PasswordToggle
                    visible={showConfirm}
                    onToggle={() => setShowConfirm((v) => !v)}
                  />
                }
              />
            </View>

            <View className="mt-6">
              <Button
                label={t('auth.signupCta')}
                onPress={submit}
                loading={submitting}
                disabled={submitting}
              />
            </View>

            <View className="mt-6 flex-row items-center">
              <View className="h-px flex-1 bg-border" />
              <Text tone="secondary" className="mx-3 text-sm">
                {t('auth.orDivider')}
              </Text>
              <View className="h-px flex-1 bg-border" />
            </View>

            <View className="mt-6">
              <GoogleButton
                label={t('auth.continueWithGoogle')}
                disabled={submitting}
              />
            </View>
          </View>

          <View className="mt-8 flex-row items-center justify-center">
            <Text tone="secondary" className="text-sm">
              {t('auth.haveAccount')}{' '}
            </Text>
            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              haptic="light"
              accessibilityRole="link"
            >
              <Text weight="bold" tone="brand" className="text-sm">
                {t('auth.logInLink')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </ScreenContainer>
  );
}
