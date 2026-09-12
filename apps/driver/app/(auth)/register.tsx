import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSignUp } from '@clerk/clerk-expo';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { resolveDriverPhone } from '@teeko/shared';
import { useT } from '@teeko/i18n';
import { api } from '../../lib/api';

export default function RegisterScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const { signUp, setActive, isLoaded } = useSignUp();
  const t = useT();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  // National number only — '+60' is a fixed prefix, never typed.
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [fullNameError, setFullNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const styles = createStyles(colors);

  const handleRegister = async () => {
    if (!isLoaded) return;
    let valid = true;
    if (!fullName.trim()) { setFullNameError('Full name is required.'); valid = false; }
    if (!email.trim()) { setEmailError('Email is required.'); valid = false; }
    if (password.length < 8) { setPasswordError('Password must be at least 8 characters.'); valid = false; }
    // Same function the server uses, so the inline message and the API's
    // verdict can never disagree about what a valid driver number is.
    const resolvedPhone = resolveDriverPhone({ nationalNumber: phone });
    if (!resolvedPhone.ok) {
      setPhoneError(
        resolvedPhone.error === 'phone_country_not_allowed'
          ? t('phone.countryNotAllowed')
          : resolvedPhone.error === 'phone_required'
            ? t('phone.required')
            : t('phone.myMobileOnly'),
      );
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    try {
      const created = await signUp!.create({
        firstName: fullName.trim().split(' ')[0],
        lastName: fullName.trim().split(' ').slice(1).join(' ') || undefined,
        emailAddress: email.trim(),
        password,
      });

      if (created.status === 'complete') {
        await setActive({ session: created.createdSessionId! });
        // me() is what JIT-provisions our users row, so it has to land before
        // the number can be attached to it.
        await api.auth.me().catch(() => {});
        // Clerk owns sign-up, so there is no register endpoint to carry the
        // number in. If this write is lost (offline, app killed mid-flow) the
        // blocking add-phone gate catches it at next launch — not worth
        // failing a completed sign-up over.
        await api.auth.setInitialPhone(phone.trim()).catch((err: unknown) => {
          console.warn('[register] initial phone write failed; gate will catch it', err);
        });
        router.replace('/(auth)/verify-email');
      } else {
        Alert.alert('Registration failed', `Sign-up incomplete (status: ${created.status}). Disable email verification in Clerk dashboard.`);
      }
    } catch (err: unknown) {
      const clerkErr = (err as { errors?: Array<{ code?: string; message?: string }> }).errors?.[0];
      if (clerkErr?.code === 'form_identifier_exists') {
        setEmailError('An account with this email already exists.');
      } else if (clerkErr?.code === 'form_param_format_invalid' && clerkErr?.message?.includes('email')) {
        setEmailError('Invalid email address.');
      } else if (clerkErr?.code === 'form_password_pwned' || clerkErr?.code === 'form_password_length_too_short') {
        setPasswordError(clerkErr.message ?? 'Password is too weak.');
      } else {
        Alert.alert('Registration failed', clerkErr?.message ?? 'Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                <Text style={styles.inputLabel}>PHONE</Text>
                {/* Static '+60', not a picker: a driver's number goes on the
                    APAD/JPJ operator record and riders dial it mid-trip. */}
                <View style={[styles.phoneRow, phoneError && styles.inputError]}>
                  <Text style={styles.phonePrefix}>+60</Text>
                  <View style={styles.phoneDivider} />
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="12-345 6789"
                    placeholderTextColor={colors.textMut}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    maxLength={24}
                    value={phone}
                    onChangeText={(v) => { setPhone(v); if (phoneError) setPhoneError(undefined); }}
                  />
                </View>
                <Text style={styles.inputHint}>{t('phone.driverHelper')}</Text>
                {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
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
  // The '+60' chip and the national-number field read as one control.
  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  phonePrefix: { color: colors.text, fontSize: 17, fontWeight: '600' },
  phoneDivider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: 12 },
  phoneInput: { flex: 1, paddingVertical: 16, color: colors.text, fontSize: 17 },
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
