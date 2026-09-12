import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, View } from 'react-native';

import { useAuthStore, useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { resolveRiderPhone } from '@teeko/shared';
import { Button, Input, PhoneInput, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

import { GoogleButton } from '../../components/GoogleButton';
import { PasswordToggle } from '../../components/PasswordToggle';
import { useGoogleAuth } from '../../lib/useGoogleAuth';

const PASSWORD_MIN = 8;

export default function SignupScreen() {
  const router = useRouter();
  const t = useT();
  const { signUp, setActive, isLoaded } = useSignUp();
  const pushToast = useUIStore((s) => s.pushToast);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const setInitialPhone = useAuthStore((s) => s.setInitialPhone);
  const recentCountries = useAuthStore((s) => s.recentCountries);
  const rememberCountry = useAuthStore((s) => s.rememberCountry);
  const { signInWithGoogle, loading: googleLoading } = useGoogleAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  // Malaysia by default — where nearly every rider is — but any country is fine.
  const [countryCode, setCountryCode] = useState('MY');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
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
    setPhoneError(undefined);

    if (!name.trim()) {
      pushToast({ kind: 'error', message: 'Name is required' });
      return;
    }
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }
    // Validated with the same function the server uses, so the inline message
    // and the API's verdict can never disagree.
    const resolvedPhone = resolveRiderPhone({ countryCode, nationalNumber: phone });
    if (!resolvedPhone.ok) {
      setPhoneError(
        t(resolvedPhone.error === 'phone_required' ? 'phone.required' : 'phone.invalid'),
      );
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
      console.log('[signup] signUp.create returned', {
        status: attempt.status,
        hasSession: !!attempt.createdSessionId,
        requiredFields: attempt.requiredFields,
        missingFields: attempt.missingFields,
        unverifiedFields: attempt.unverifiedFields,
        verifications: {
          emailAddress: attempt.verifications?.emailAddress?.status,
          phoneNumber: attempt.verifications?.phoneNumber?.status,
        },
      });
      // Clerk dashboard: "Verify at sign-up" must be OFF — we use our own
      // backend OTP (Gmail SMTP) for email verification, not Clerk's.
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        // fetchProfile is what JIT-provisions our users row, so it has to land
        // before the number can be attached to it.
        await fetchProfile().catch(() => {});
        // Clerk owns sign-up, so there is no register endpoint to carry the
        // number in. If this write is lost (offline, app killed mid-flow) the
        // account simply has no phone, and the blocking add-phone gate in
        // (main)/_layout.tsx catches it at next launch — so a failure here is
        // never worth blocking a completed sign-up over.
        try {
          await setInitialPhone({
            countryCode,
            nationalNumber: phone.trim(),
          });
        } catch (err) {
          console.warn('[signup] initial phone write failed; add-phone gate will catch it', err);
        }
        router.replace('/(auth)/verify-email');
      } else {
        const missing = attempt.missingFields ?? [];
        pushToast({
          kind: 'error',
          message:
            missing.length > 0
              ? `Sign-up needs: ${missing.join(', ')} (check Clerk dashboard — email verification must be OFF)`
              : `Sign-up incomplete (status: ${attempt.status}). Disable email verification in Clerk.`,
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
              <PhoneInput
                country="picker"
                label={t('phone.label')}
                countryCode={countryCode}
                onCountryCodeChange={setCountryCode}
                onCountryUsed={rememberCountry}
                recentCountries={recentCountries}
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  if (phoneError) setPhoneError(undefined);
                }}
                error={phoneError}
                searchPlaceholder={t('phone.searchCountry')}
                recentLabel={t('phone.recent')}
                allCountriesLabel={t('phone.allCountries')}
                noResultsLabel={t('phone.noCountryResults')}
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
                onPress={signInWithGoogle}
                loading={googleLoading}
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
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
