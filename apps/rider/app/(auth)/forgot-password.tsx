import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, View } from 'react-native';

import { authApi, useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { cooldownSentence } from '@teeko/shared';
import { Button, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useSignIn } from '@clerk/clerk-expo';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { GoogleButton } from '../../components/GoogleButton';
import { PasswordToggle } from '../../components/PasswordToggle';
import { useGoogleAuth } from '../../lib/useGoogleAuth';

type Step = 'request' | 'reset' | 'mfa';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const t = useT();
  const { signIn, setActive, isLoaded } = useSignIn();
  const pushToast = useUIStore((s) => s.pushToast);
  const { signInWithGoogle, loading: googleLoading } = useGoogleAuth();
  const params = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [otpError, setOtpError] = useState<string | undefined>();

  const errorCode = (err: unknown) =>
    (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;

  const sendCode = async () => {
    if (!isLoaded || !signIn) return;
    setEmailError(undefined);
    setSubmitting(true);
    try {
      // A password may only be reset once a week. Clerk doesn't know that rule,
      // so ask our own API before asking Clerk to send anything. An unknown
      // address always answers "allowed", so this stays a non-oracle.
      const eligibility = await authApi
        .checkPasswordResetEligibility(email.trim())
        .catch(() => null);
      if (eligibility && !eligibility.allowed && eligibility.nextAllowedAt) {
        setEmailError(cooldownSentence('reset your password', eligibility.nextAllowedAt));
        return;
      }
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email.trim() });
      setStep('reset');
    } catch (err) {
      const code = errorCode(err);
      if (code === 'form_param_format_invalid') {
        setEmailError(t('auth.invalidEmail'));
      } else if (code === 'form_identifier_not_found') {
        // Deliberately indistinguishable from success — surfacing this would turn
        // the screen into an "is this email a Teeko user" oracle. The user reaches
        // the code step and the code simply never arrives.
        setStep('reset');
      } else if (code === 'too_many_requests') {
        pushToast({ kind: 'error', message: t('auth.tooManyRequests') });
      } else {
        pushToast({ kind: 'error', message: 'Something went wrong. Try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (!isLoaded || !signIn || !setActive) return;
    setCodeError(undefined);
    setPasswordError(undefined);
    setSubmitting(true);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password: newPassword,
      });
      // Clerk has accepted the new password by the time either branch below
      // runs, so the 7-day clock starts here. Best-effort: the Clerk
      // `user.updated` webhook stamps the same instant server-side if this
      // call never lands.
      void authApi.recordPasswordReset(email.trim()).catch(() => {});
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        pushToast({ kind: 'info', message: t('auth.forgotSuccessToast') });
        router.replace('/(main)/(tabs)');
      } else if (attempt.status === 'needs_second_factor') {
        // The password is already changed at this point; the second factor gates
        // the session, not the write. Abandoning here still leaves a usable password.
        await signIn.prepareSecondFactor({ strategy: 'email_code' });
        setStep('mfa');
      } else {
        pushToast({ kind: 'error', message: 'Reset incomplete. Try again.' });
      }
    } catch (err) {
      const c = errorCode(err);
      if (c === 'form_code_incorrect' || c === 'verification_failed') {
        setCodeError(t('auth.codeIncorrect'));
      } else if (c === 'verification_expired') {
        setCodeError(t('auth.codeExpired'));
      } else if (c === 'form_password_pwned') {
        setPasswordError(t('auth.passwordPwned'));
      } else if (c === 'form_password_length_too_short') {
        setPasswordError(t('auth.passwordTooShort'));
      } else if (c === 'form_password_validation_failed') {
        setPasswordError(t('auth.passwordWeak'));
      } else if (c === 'too_many_requests') {
        pushToast({ kind: 'error', message: t('auth.tooManyRequests') });
      } else {
        pushToast({ kind: 'error', message: 'Something went wrong. Try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async () => {
    if (!isLoaded || !signIn || !setActive) return;
    setOtpError(undefined);
    setSubmitting(true);
    try {
      const attempt = await signIn.attemptSecondFactor({ strategy: 'email_code', code: otpCode.trim() });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        pushToast({ kind: 'info', message: t('auth.forgotSuccessToast') });
        router.replace('/(main)/(tabs)');
      } else {
        pushToast({ kind: 'error', message: 'Verification incomplete. Try again.' });
      }
    } catch (err) {
      const c = errorCode(err);
      if (c === 'form_code_incorrect' || c === 'verification_failed') {
        setOtpError(t('auth.codeIncorrect'));
      } else if (c === 'verification_expired') {
        setOtpError(t('auth.codeExpired'));
      } else if (c === 'too_many_requests') {
        pushToast({ kind: 'error', message: t('auth.tooManyRequests') });
      } else {
        pushToast({ kind: 'error', message: 'Something went wrong. Try again.' });
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
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', paddingBottom: 24, paddingTop: 32 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View>
              <Text weight="bold" className="text-3xl leading-tight">
                {step === 'mfa' ? t('auth.forgotOtpTitle') : t('auth.forgotTitle')}
              </Text>
              <Text tone="secondary" className="mt-2 text-base">
                {step === 'request' ? t('auth.forgotSubtitle') : null}
                {step === 'reset' ? t('auth.forgotSentNeutral') : null}
                {step === 'mfa' ? t('auth.forgotOtpBody') : null}
              </Text>

              {step === 'request' ? (
                <>
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
                  </View>

                  <View className="mt-6">
                    <Button
                      label={t('auth.forgotSendCta')}
                      onPress={sendCode}
                      loading={submitting}
                      disabled={!email}
                    />
                  </View>

                  <View className="mt-6 flex-row items-center">
                    <View className="h-px flex-1 bg-border" />
                    <Text tone="secondary" className="mx-3 text-sm">
                      {t('auth.orDivider')}
                    </Text>
                    <View className="h-px flex-1 bg-border" />
                  </View>

                  {/* Google-only riders have no password to reset — Clerk answers
                      form_identifier_not_found, which we deliberately swallow above. */}
                  <Text tone="secondary" className="mt-6 text-center text-sm">
                    {t('auth.forgotGoogleHint')}
                  </Text>
                  <View className="mt-4">
                    <GoogleButton
                      label={t('auth.continueWithGoogle')}
                      onPress={signInWithGoogle}
                      loading={googleLoading}
                      disabled={submitting}
                    />
                  </View>
                </>
              ) : null}

              {step === 'reset' ? (
                <>
                  <View className="mt-8 gap-4">
                    <Input
                      label={t('auth.verifyCodeLabel')}
                      placeholder="123456"
                      keyboardType="number-pad"
                      autoCapitalize="none"
                      maxLength={6}
                      value={code}
                      onChangeText={(v) => {
                        setCode(v);
                        if (codeError) setCodeError(undefined);
                      }}
                      error={codeError}
                    />
                    <Input
                      label={t('auth.forgotNewPasswordLabel')}
                      placeholder="••••••••"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password-new"
                      value={newPassword}
                      onChangeText={(v) => {
                        setNewPassword(v);
                        if (passwordError) setPasswordError(undefined);
                      }}
                      error={passwordError}
                      trailingAdornment={
                        <PasswordToggle
                          visible={showPassword}
                          onToggle={() => setShowPassword((v) => !v)}
                        />
                      }
                    />
                  </View>

                  <View className="mt-6">
                    <Button
                      label={t('auth.forgotResetCta')}
                      onPress={resetPassword}
                      loading={submitting}
                      disabled={!code || !newPassword}
                    />
                  </View>

                  <Pressable className="mt-4" onPress={() => setStep('request')} haptic="light">
                    <Text tone="secondary" className="text-center text-sm">
                      {t('auth.resend')}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {step === 'mfa' ? (
                <>
                  <View className="mt-8 gap-4">
                    <Input
                      label={t('auth.verifyCodeLabel')}
                      placeholder="123456"
                      keyboardType="number-pad"
                      autoCapitalize="none"
                      maxLength={6}
                      value={otpCode}
                      onChangeText={(v) => {
                        setOtpCode(v);
                        if (otpError) setOtpError(undefined);
                      }}
                      error={otpError}
                    />
                  </View>

                  <View className="mt-6">
                    <Button
                      label={t('auth.verifyCta')}
                      onPress={submitOtp}
                      loading={submitting}
                      disabled={!otpCode}
                    />
                  </View>
                </>
              ) : null}
            </View>

            <View className="flex-row items-center justify-center">
              <Pressable
                onPress={() => router.replace('/(auth)/login')}
                haptic="light"
                accessibilityRole="link"
              >
                <Text weight="bold" tone="brand" className="text-sm">
                  {t('auth.forgotBackToLogin')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
