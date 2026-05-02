import { useState } from 'react';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';

import { useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { Button, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

import { GoogleButton } from '../../components/GoogleButton';

export default function LoginScreen() {
  const router = useRouter();
  const t = useT();
  const { signIn, setActive, isLoaded } = useSignIn();
  const pushToast = useUIStore((s) => s.pushToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const submit = async () => {
    if (!isLoaded || !signIn || !setActive) return;
    setEmailError(undefined);
    setPasswordError(undefined);
    setSubmitting(true);
    try {
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.back();
      } else {
        pushToast({ kind: 'error', message: 'Login incomplete. Try again.' });
      }
    } catch (err) {
      const code = (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;
      if (code === 'form_identifier_not_found' || code === 'form_param_format_invalid') {
        setEmailError(t('auth.invalidEmail'));
      } else if (code === 'form_password_incorrect') {
        setPasswordError(t('auth.invalidPassword'));
      } else {
        pushToast({ kind: 'error', message: 'Something went wrong. Try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View className="flex-1 justify-between pb-6 pt-8">
          <View>
            <Text weight="bold" className="text-3xl leading-tight">
              {t('auth.loginTitle')}
            </Text>
            <Text tone="secondary" className="mt-2 text-base">
              {t('auth.loginSubtitle')}
            </Text>

            <View className="mt-8 gap-4">
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
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
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
                label={t('auth.loginCta')}
                onPress={submit}
                loading={submitting}
                disabled={!email || !password}
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

          <View className="flex-row items-center justify-center">
            <Text tone="secondary" className="text-sm">
              {t('auth.noAccount')}{' '}
            </Text>
            <Pressable
              onPress={() => router.replace('/(auth)/signup')}
              haptic="light"
              accessibilityRole="link"
            >
              <Text weight="bold" tone="brand" className="text-sm">
                {t('auth.signUpLink')}
              </Text>
            </Pressable>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </ScreenContainer>
  );
}
