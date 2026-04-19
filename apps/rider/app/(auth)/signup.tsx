import { useState } from 'react';
import { Keyboard, ScrollView, TouchableWithoutFeedback, View } from 'react-native';

import { useAuthStore, useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { Button, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { GoogleButton } from '../../components/GoogleButton';

export default function SignupScreen() {
  const router = useRouter();
  const t = useT();
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const pushToast = useUIStore((s) => s.pushToast);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const submit = async () => {
    setEmailError(undefined);
    setPasswordError(undefined);
    setSubmitting(true);
    try {
      await signUpWithEmail(name.trim(), email.trim(), password);
      router.replace('/(auth)/verify-email');
    } catch (err) {
      const errName = (err as Error).name;
      if (errName === 'EMAIL_INVALID') setEmailError(t('auth.invalidEmail'));
      else if (errName === 'PASSWORD_INVALID') setPasswordError(t('auth.invalidPassword'));
      else pushToast({ kind: 'error', message: 'Something went wrong. Try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.back();
    } catch {
      pushToast({ kind: 'error', message: 'Google sign-in failed. Try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={{ paddingVertical: 24, flexGrow: 1, justifyContent: 'space-between' }}
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
                placeholder="At least 6 characters"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (passwordError) setPasswordError(undefined);
                }}
                error={passwordError}
              />
            </View>

            <View className="mt-6">
              <Button
                label={t('auth.signupCta')}
                onPress={submit}
                loading={submitting}
                disabled={!name.trim() || !email || !password}
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
                onPress={onGoogle}
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
