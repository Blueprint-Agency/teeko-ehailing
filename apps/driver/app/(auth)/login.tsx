import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSignIn } from '@clerk/clerk-expo';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { useDriverStore } from '../../store/useDriverStore';

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [mfaStep, setMfaStep] = useState(false);
  const [clientTrustStep, setClientTrustStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | undefined>();
  const [devToken, setDevToken] = useState(__DEV__ ? 'dev-bypass-token' : '');
  const [showDev, setShowDev] = useState(false);
  const pendingCredsRef = useRef<{ email: string; password: string } | null>(null);
  const verifyStrategyRef = useRef<'email_code' | 'phone_code'>('email_code');
  const setToken = useDriverStore((s) => s.setToken);

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
          router.replace('/(driver)/(tabs)/home');
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
        router.replace('/(driver)/(tabs)/home');
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
        router.replace('/(driver)/(tabs)/home');
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
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
                <TextInput
                  style={[styles.textInput, passwordError && styles.inputError]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMut}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                  value={password}
                  onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(undefined); }}
                />
                {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
              </View>

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

          {/* Dev bypass */}
          <TouchableOpacity onPress={() => setShowDev((v) => !v)} style={styles.devToggle}>
            <Text style={styles.devToggleText}>{showDev ? '▲ Dev bypass' : '▼ Dev bypass'}</Text>
          </TouchableOpacity>

          {showDev && (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>Paste Clerk JWT</Text>
              <TextInput
                style={styles.devInput}
                placeholder="eyJ..."
                placeholderTextColor={colors.textMut}
                value={devToken}
                onChangeText={setDevToken}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.devBtn}
                onPress={() => {
                  const tok = devToken.trim();
                  if (!tok) { Alert.alert('Empty token'); return; }
                  setToken(tok);
                  router.replace('/(driver)/(tabs)/home');
                }}
              >
                <Text style={styles.devBtnText}>Use token & continue →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },

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

  registerLink: { alignItems: 'center', marginBottom: 12 },
  registerLinkText: { color: colors.textSec, fontSize: 14 },
  registerLinkAccent: { color: colors.accent, fontWeight: '700' },

  devToggle: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  devToggleText: { color: colors.textMut, fontSize: 11, fontWeight: '600' },
  devBox: {
    marginTop: 8, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    borderStyle: 'dashed',
  },
  devLabel: { color: colors.textMut, fontSize: 11, fontWeight: '700', marginBottom: 8 },
  devInput: {
    backgroundColor: colors.surfaceHigh, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    padding: 10, color: colors.text, fontSize: 11,
    minHeight: 60, fontFamily: 'monospace',
    marginBottom: 10,
  },
  devBtn: {
    backgroundColor: colors.surfaceHigh, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 10, alignItems: 'center',
  },
  devBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
});
