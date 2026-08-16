import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSignIn } from '@clerk/clerk-expo';
import { Eye, EyeOff } from 'lucide-react-native';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { resolveRouteAfterAuth } from '../../lib/routeAfterAuth';

type Step = 'request' | 'reset' | 'mfa';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const { signIn, setActive, isLoaded } = useSignIn();
  const params = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [otpError, setOtpError] = useState<string | undefined>();
  const verifyStrategyRef = useRef<'email_code' | 'phone_code'>('email_code');

  const styles = createStyles(colors);

  const errorCode = (err: unknown) =>
    (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;

  // Mirrors login.tsx: pick whichever second factor this driver actually has
  // enrolled rather than assuming email_code, so a phone_code driver isn't dead-ended.
  const prepareSecond = async (resource: { supportedSecondFactors?: Array<{ strategy: string }> }) => {
    const preferred = ['email_code', 'phone_code'] as const;
    const strategy = (resource.supportedSecondFactors?.find(f =>
      (preferred as readonly string[]).includes(f.strategy)
    )?.strategy ?? 'email_code') as typeof preferred[number];
    verifyStrategyRef.current = strategy;
    await signIn!.prepareSecondFactor({ strategy });
    setStep('mfa');
  };

  const sendCode = async () => {
    if (!isLoaded || !signIn || !email.trim()) return;
    setEmailError(undefined);
    setLoading(true);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email.trim() });
      setStep('reset');
    } catch (err) {
      const c = errorCode(err);
      if (c === 'form_param_format_invalid') {
        setEmailError('Invalid email address.');
      } else if (c === 'form_identifier_not_found') {
        // Suppressed on purpose — otherwise this screen becomes an account-existence
        // oracle for anyone with an email list. The code simply never arrives.
        setStep('reset');
      } else if (c === 'too_many_requests') {
        Alert.alert('Too many attempts', 'Please try again shortly.');
      } else {
        Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!isLoaded || !signIn || !code.trim() || !newPassword) return;
    setCodeError(undefined);
    setPasswordError(undefined);
    setLoading(true);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password: newPassword,
      });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace(await resolveRouteAfterAuth());
      } else if (attempt.status === 'needs_second_factor' || (attempt.status as string) === 'needs_client_trust') {
        // Password is already changed here — the factor below gates the session only.
        await prepareSecond(attempt as any);
      } else {
        Alert.alert('Reset incomplete', 'Please try again.');
      }
    } catch (err) {
      const c = errorCode(err);
      if (c === 'form_code_incorrect' || c === 'verification_failed') {
        setCodeError('Incorrect or expired code.');
      } else if (c === 'verification_expired') {
        setCodeError('Code expired. Tap resend.');
      } else if (c === 'form_password_pwned') {
        setPasswordError('That password has appeared in a data breach. Choose another.');
      } else if (c === 'form_password_length_too_short') {
        setPasswordError('Use at least 8 characters.');
      } else if (c === 'form_password_validation_failed') {
        setPasswordError('Choose a stronger password.');
      } else if (c === 'too_many_requests') {
        Alert.alert('Too many attempts', 'Please try again shortly.');
      } else {
        Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!isLoaded || !signIn || !otpCode.trim()) return;
    setOtpError(undefined);
    setLoading(true);
    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: verifyStrategyRef.current,
        code: otpCode.trim(),
      });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace(await resolveRouteAfterAuth());
      } else {
        Alert.alert('Verification incomplete', 'Please try again.');
      }
    } catch (err) {
      const c = errorCode(err);
      if (c === 'form_code_incorrect' || c === 'verification_failed') {
        setOtpError('Invalid code. Please try again.');
      } else if (c === 'verification_expired') {
        setOtpError('Code expired. Go back and try again.');
      } else if (c === 'too_many_requests') {
        Alert.alert('Too many attempts', 'Please try again shortly.');
      } else {
        Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const heading = step === 'mfa' ? t('auth.forgotOtpTitle') : t('auth.forgotTitle');
  const hint = step === 'request'
    ? t('auth.forgotSubtitle')
    : step === 'reset'
      ? t('auth.forgotSentNeutral')
      : t('auth.forgotOtpBody');

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.logoBlock}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>T</Text>
            </View>
            <Text style={styles.brand}>{heading}</Text>
            <Text style={styles.tagline}>{hint}</Text>
          </View>

          {step === 'request' && (
            <>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>EMAIL</Text>
                <TextInput
                  style={[styles.textInput, emailError && styles.inputError]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMut}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(undefined); }}
                  autoFocus
                />
                {emailError && <Text style={styles.errorText}>{emailError}</Text>}
              </View>

              <TouchableOpacity
                style={[styles.continueBtn, loading && { opacity: 0.6 }]}
                onPress={sendCode}
                activeOpacity={0.85}
                disabled={loading || !email}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.continueBtnText}>{t('auth.forgotSendCta')}</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'reset' && (
            <>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>VERIFICATION CODE</Text>
                <TextInput
                  style={[styles.textInput, styles.otpInput, codeError && styles.inputError]}
                  placeholder="123456"
                  placeholderTextColor={colors.textMut}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={(v) => { setCode(v); if (codeError) setCodeError(undefined); }}
                  maxLength={6}
                  autoFocus
                />
                {codeError && <Text style={styles.errorText}>{codeError}</Text>}
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.textInput, styles.passwordInput, passwordError && styles.inputError]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMut}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password-new"
                    value={newPassword}
                    onChangeText={(v) => { setNewPassword(v); if (passwordError) setPasswordError(undefined); }}
                  />
                  <TouchableOpacity
                    style={styles.revealBtn}
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword
                      ? <EyeOff size={20} color={colors.textSec} />
                      : <Eye size={20} color={colors.textSec} />}
                  </TouchableOpacity>
                </View>
                {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
              </View>

              <TouchableOpacity
                style={[styles.continueBtn, loading && { opacity: 0.6 }]}
                onPress={resetPassword}
                activeOpacity={0.85}
                disabled={loading || !code || !newPassword}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.continueBtnText}>{t('auth.forgotResetCta')}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.registerLink} onPress={() => setStep('request')}>
                <Text style={styles.registerLinkText}>← {t('auth.resend')}</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'mfa' && (
            <>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>VERIFICATION CODE</Text>
                <TextInput
                  style={[styles.textInput, styles.otpInput, otpError && styles.inputError]}
                  placeholder="123456"
                  placeholderTextColor={colors.textMut}
                  keyboardType="number-pad"
                  value={otpCode}
                  onChangeText={(v) => { setOtpCode(v); if (otpError) setOtpError(undefined); }}
                  maxLength={6}
                  autoFocus
                />
                {otpError && <Text style={styles.errorText}>{otpError}</Text>}
              </View>

              <TouchableOpacity
                style={[styles.continueBtn, loading && { opacity: 0.6 }]}
                onPress={verifyOtp}
                activeOpacity={0.85}
                disabled={loading || !otpCode}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.continueBtnText}>Verify</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.registerLink} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.registerLinkAccent}>{t('auth.forgotBackToLogin')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },

  logoBlock: { alignItems: 'center', marginBottom: 40 },
  logo: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { color: '#000', fontSize: 40, fontWeight: '900' },
  brand: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  tagline: { color: colors.textSec, fontSize: 14, marginTop: 8, textAlign: 'center' },

  inputBlock: { marginBottom: 16 },
  inputLabel: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  textInput: {
    paddingHorizontal: 16, paddingVertical: 16,
    color: colors.text, fontSize: 17,
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  passwordRow: { justifyContent: 'center' },
  // Room for the reveal button so long passwords don't run underneath it.
  passwordInput: { paddingRight: 52 },
  revealBtn: {
    position: 'absolute', right: 0,
    height: '100%', width: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  otpInput: { letterSpacing: 8, fontSize: 24, fontWeight: '700', textAlign: 'center' },

  continueBtn: {
    height: 58, borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  continueBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },

  registerLink: { alignItems: 'center', marginBottom: 12 },
  registerLinkText: { color: colors.textSec, fontSize: 14 },
  registerLinkAccent: { color: colors.accent, fontWeight: '700', fontSize: 14 },
});
