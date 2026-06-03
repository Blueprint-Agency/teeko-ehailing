import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSignUp } from '@clerk/clerk-expo';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';

export default function RegisterScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const { signUp, setActive, isLoaded } = useSignUp();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [fullNameError, setFullNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  // Email verification step
  const [verifyStep, setVerifyStep] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();

  const styles = createStyles(colors);

  const handleRegister = async () => {
    if (!isLoaded) return;
    let valid = true;
    if (!fullName.trim()) { setFullNameError('Full name is required.'); valid = false; }
    if (!email.trim()) { setEmailError('Email is required.'); valid = false; }
    if (password.length < 8) { setPasswordError('Password must be at least 8 characters.'); valid = false; }
    if (!valid) return;

    setLoading(true);
    try {
      // If the user went back from the verify step, signUp is already created
      // and in 'missing_requirements' state. Skip create and just resend the code.
      if (signUp?.status === 'missing_requirements') {
        try {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        } catch {
          // Already prepared
        }
        setVerifyStep(true);
        return;
      }

      const created = await signUp!.create({
        firstName: fullName.trim().split(' ')[0],
        lastName: fullName.trim().split(' ').slice(1).join(' ') || undefined,
        emailAddress: email.trim(),
        password,
      });

      if (created.status === 'complete') {
        // Clerk instance doesn't require email verification — activate immediately.
        await setActive({ session: created.createdSessionId! });
        router.replace('/(driver)/(tabs)/home');
        return;
      }

      // Needs email verification
      await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
      setVerifyStep(true);
    } catch (err: unknown) {
      const clerkErr = (err as { errors?: Array<{ code?: string; message?: string }> }).errors?.[0];
      if (clerkErr?.code === 'form_identifier_exists') {
        setEmailError('An account with this email already exists.');
      } else if (clerkErr?.code === 'form_param_format_invalid' && clerkErr?.message?.includes('email')) {
        setEmailError('Invalid email address.');
      } else if (clerkErr?.code === 'form_password_pwned' || clerkErr?.code === 'form_password_length_too_short') {
        setPasswordError(clerkErr.message ?? 'Password is too weak.');
      } else if (clerkErr?.code === 'invalid_action') {
        // Already created — go straight to verify step
        setVerifyStep(true);
      } else {
        Alert.alert('Registration failed', clerkErr?.message ?? 'Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !code.trim()) return;
    setCodeError(undefined);
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // TokenSync in _layout.tsx will fire immediately after isSignedIn becomes
        // true, fetch the token, and call api.auth.me() to JIT-provision the DB row.
        router.replace('/(driver)/(tabs)/home');
      } else {
        Alert.alert('Verification incomplete', 'Please try again.');
      }
    } catch (err: unknown) {
      const errCode = (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;
      if (errCode === 'form_code_incorrect' || errCode === 'verification_failed') {
        setCodeError('Invalid code. Please try again.');
      } else if (errCode === 'verification_expired') {
        setCodeError('Code expired. Go back and resend.');
      } else {
        Alert.alert('Error', 'Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.logoBlock}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>T</Text>
            </View>
            <Text style={styles.brand}>teeko</Text>
            <Text style={styles.tagline}>Create your driver account</Text>
          </View>

          {verifyStep ? (
            <>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>VERIFICATION CODE</Text>
                <Text style={styles.inputHint}>A 6-digit code was sent to {email}.</Text>
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

              <TouchableOpacity
                style={[styles.continueBtn, loading && { opacity: 0.6 }]}
                onPress={handleVerify}
                activeOpacity={0.85}
                disabled={loading || !code}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.continueBtnText}>Verify & Create Account</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkBtn} onPress={() => { setVerifyStep(false); setCode(''); }}>
                <Text style={styles.linkText}>← Back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>FULL NAME</Text>
                <TextInput
                  style={[styles.textInput, fullNameError && styles.inputError]}
                  placeholder="Ahmad bin Ali"
                  placeholderTextColor={colors.textMut}
                  autoCapitalize="words"
                  autoComplete="name"
                  value={fullName}
                  onChangeText={(v) => { setFullName(v); if (fullNameError) setFullNameError(undefined); }}
                  autoFocus
                />
                {fullNameError && <Text style={styles.errorText}>{fullNameError}</Text>}
              </View>

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
                />
                {emailError && <Text style={styles.errorText}>{emailError}</Text>}
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>PASSWORD</Text>
                <TextInput
                  style={[styles.textInput, passwordError && styles.inputError]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.textMut}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  value={password}
                  onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(undefined); }}
                />
                {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
              </View>

              <TouchableOpacity
                style={[styles.continueBtn, loading && { opacity: 0.6 }]}
                onPress={handleRegister}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.continueBtnText}>Create Account</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.linkText}>Already have an account? <Text style={styles.linkAccent}>Sign in</Text></Text>
              </TouchableOpacity>
            </>
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
  backBtn: { position: 'absolute', top: 56, left: 24 },
  backText: { color: colors.accent, fontSize: 16 },

  logoBlock: { alignItems: 'center', marginBottom: 40 },
  logo: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  logoText: { color: '#000', fontSize: 36, fontWeight: '900' },
  brand: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
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
  otpInput: { letterSpacing: 8, fontSize: 24, fontWeight: '700', textAlign: 'center' },

  continueBtn: {
    height: 58, borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, marginTop: 8,
  },
  continueBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },

  linkBtn: { alignItems: 'center', marginTop: 4 },
  linkText: { color: colors.textSec, fontSize: 14 },
  linkAccent: { color: colors.accent, fontWeight: '700' },
});
