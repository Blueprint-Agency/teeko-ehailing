import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSignIn } from '@clerk/clerk-expo';
import { Eye, EyeOff } from 'lucide-react-native';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { resolveRouteAfterAuth } from '../../lib/routeAfterAuth';

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [mfaStep, setMfaStep] = useState(false);
  const [clientTrustStep, setClientTrustStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | undefined>();
  const pendingCredsRef = useRef<{ email: string; password: string } | null>(null);
  const verifyStrategyRef = useRef<'email_code' | 'phone_code'>('email_code');

  const styles = createStyles(colors);

  const prepareClientTrust = async (resource: { supportedSecondFactors?: Array<{ strategy: string }> }) => {
    const preferred = ['email_code', 'phone_code'] as const;
    const strategy = (resource.supportedSecondFactors?.find(f =>
      (preferred as readonly string[]).includes(f.strategy)
    )?.strategy ?? 'email_code') as typeof preferred[number];
    verifyStrategyRef.current = strategy;
    await signIn!.prepareSecondFactor({ strategy });
    setClientTrustStep(true);
  };

  const doSignIn = async () => {
    if (!isLoaded || !signIn) return;
    const creds = pendingCredsRef.current;
    if (!creds) return;
    setLoading(true);
    try {
      const identified = await signIn.create({ identifier: creds.email });

      if (identified.status === 'needs_first_factor') {
        const attempt = await signIn.attemptFirstFactor({ strategy: 'password', password: creds.password });
        if (attempt.status === 'complete') {
          await setActive({ session: attempt.createdSessionId });
          router.replace(await resolveRouteAfterAuth());
        } else if (attempt.status === 'needs_second_factor') {
          verifyStrategyRef.current = 'email_code';
          await signIn.prepareSecondFactor({ strategy: 'email_code' });
          setMfaStep(true);
        } else if ((attempt.status as string) === 'needs_client_trust') {
          await prepareClientTrust(attempt as any);
        } else {
          Alert.alert('Login incomplete', 'Please try again.');
        }
      } else if (identified.status === 'complete') {
        await setActive({ session: identified.createdSessionId });
        router.replace(await resolveRouteAfterAuth());
      } else if ((identified.status as string) === 'needs_client_trust') {
        await prepareClientTrust(identified as any);
      } else {
        Alert.alert('Login incomplete', `Status: ${identified.status}. Please try again.`);
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ code?: string; message?: string }> };
      const code = clerkErr.errors?.[0]?.code;
      if (code === 'form_identifier_not_found' || code === 'form_param_format_invalid') {
        setEmailError('Invalid email address.');
      } else if (code === 'form_password_incorrect') {
        setPasswordError('Incorrect password.');
      } else {
        Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!isLoaded || !signIn || !email.trim() || !password) return;
    setEmailError(undefined);
    setPasswordError(undefined);
    pendingCredsRef.current = { email: email.trim(), password };
    await doSignIn();
  };

  const handleVerifyOtp = async () => {
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
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ code?: string; message?: string }> };
      const code = clerkErr.errors?.[0]?.code;
      if (code === 'form_code_incorrect' || code === 'verification_failed') {
        setOtpError('Invalid code. Please try again.');
      } else if (code === 'verification_expired') {
        setOtpError('Code expired. Go back and try again.');
      } else {
        Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetToLogin = () => {
    setMfaStep(false);
    setClientTrustStep(false);
    setOtpCode('');
    setOtpError(undefined);
  };

  const showOtpStep = mfaStep || clientTrustStep;
  const otpHint = clientTrustStep
    ? 'A verification code was sent to confirm this device.'
    : 'A code was sent to your email.';

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={styles.logoBlock}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>T</Text>
            </View>
            <Text style={styles.brand}>teeko</Text>
            <Text style={styles.tagline}>{t('driver.loginTagline')}</Text>
          </View>

          {showOtpStep ? (
            <>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>VERIFICATION CODE</Text>
                <Text style={styles.inputHint}>{otpHint}</Text>
                <TextInput
                  style={[styles.textInput, styles.otpInput]}
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
                onPress={handleVerifyOtp}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.continueBtnText}>Verify</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.registerLink} onPress={resetToLogin}>
                <Text style={styles.registerLinkText}>← Back</Text>
              </TouchableOpacity>
            </>
          ) : (
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

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>PASSWORD</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.textInput, styles.passwordInput, passwordError && styles.inputError]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMut}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                    value={password}
                    onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(undefined); }}
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
                style={styles.forgotLink}
                onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email: email.trim() } })}
              >
                <Text style={styles.forgotLinkText}>{t('auth.forgotPasswordLink')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.continueBtn, loading && { opacity: 0.6 }]}
                onPress={handleLogin}
                activeOpacity={0.85}
                disabled={loading || !email || !password}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.continueBtnText}>{t('driver.continue')}</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/(auth)/register-choice')}
          >
            <Text style={styles.registerLinkText}>
              {t('driver.newToTeeko')} <Text style={styles.registerLinkAccent}>{t('driver.registerHere')}</Text>
            </Text>
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

  logoBlock: { alignItems: 'center', marginBottom: 48 },
  logo: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { color: '#000', fontSize: 40, fontWeight: '900' },
  brand: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: colors.textSec, fontSize: 14, marginTop: 4 },

  inputBlock: { marginBottom: 16 },
  inputLabel: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  inputHint: { color: colors.textMut, fontSize: 13, marginBottom: 8 },
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
  otpInput: {
    letterSpacing: 8, fontSize: 24, fontWeight: '700', textAlign: 'center',
  },

  continueBtn: {
    height: 58, borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  continueBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },

  forgotLink: { alignSelf: 'flex-end', marginBottom: 16, paddingVertical: 4 },
  forgotLinkText: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  registerLink: { alignItems: 'center', marginBottom: 12 },
  registerLinkText: { color: colors.textSec, fontSize: 14 },
  registerLinkAccent: { color: colors.accent, fontWeight: '700' },
});
