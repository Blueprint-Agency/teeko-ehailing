import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { Eye, EyeOff } from 'lucide-react-native';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import { useColors } from '../../../constants/colors';
import { useTheme } from '../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { ApiError, api } from '../../../lib/api';

const PASSWORD_MIN = 8;

type Step = 'send' | 'verify';

// Mirrors the rider's account/change-password screen: the emailed OTP proves
// identity, so the driver never has to type their current password (which they
// may not remember — that's usually why they're here).
export default function ChangePasswordScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const { user } = useUser();

  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  const [step, setStep] = useState<Step>('send');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const styles = createStyles(colors);

  const sendCode = async () => {
    if (!email) {
      Alert.alert(t('driver.changePassword'), 'No email on file for this account.');
      return;
    }
    setBusy(true);
    try {
      await api.auth.sendOtp();
      setStep('verify');
      Alert.alert(t('driver.changePassword'), t('driver.pwCodeSent', { email }));
    } catch (err) {
      const body = err instanceof ApiError ? err.data : {};
      if (body.error === 'rate_limited') {
        Alert.alert('Too many attempts', `Try again in ${body.retryInSeconds ?? 60}s.`);
      } else if (body.error === 'email_delivery_failed') {
        Alert.alert('Error', String(body.providerMessage ?? 'Email failed to send.'));
      } else {
        Alert.alert('Error', 'Could not send verification code.');
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setCodeError(undefined);
    setPasswordError(undefined);

    if (!code.trim()) {
      setCodeError('Enter the code from your email.');
      return;
    }
    if (newPassword.length < PASSWORD_MIN) {
      setPasswordError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api.auth.changePassword(code.trim(), newPassword);
      Alert.alert(t('driver.changePassword'), t('auth.forgotSuccessToast'));
      router.back();
    } catch (err) {
      const body = err instanceof ApiError ? err.data : {};
      if (body.error === 'incorrect' || body.error === 'no_active_code') {
        setCodeError('Invalid or expired code.');
      } else if (body.error === 'expired') {
        setCodeError('Code expired — tap resend.');
      } else if (body.error === 'too_many_attempts') {
        setCodeError('Too many attempts — tap resend.');
      } else if (body.error === 'password_rejected') {
        // The code is still valid — only the password was refused.
        setPasswordError(
          body.code === 'form_password_pwned'
            ? 'That password has appeared in a data breach. Choose another.'
            : String(body.message ?? 'Choose a stronger password.'),
        );
      } else {
        Alert.alert('Error', 'Could not update password.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.changePassword')} onBack={() => router.back()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyText}>{email || '—'}</Text>
            </View>
          </View>

          {step === 'send' ? (
            <>
              <Text style={styles.hint}>{t('driver.pwIntro')}</Text>
              <TouchableOpacity
                style={[styles.continueBtn, busy && { opacity: 0.6 }]}
                onPress={sendCode}
                activeOpacity={0.85}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.continueBtnText}>{t('driver.pwSendCta')}</Text>}
              </TouchableOpacity>
            </>
          ) : (
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
                    placeholder={`At least ${PASSWORD_MIN} characters`}
                    placeholderTextColor={colors.textMut}
                    secureTextEntry={!showNew}
                    autoCapitalize="none"
                    autoComplete="password-new"
                    textContentType="newPassword"
                    value={newPassword}
                    onChangeText={(v) => { setNewPassword(v); if (passwordError) setPasswordError(undefined); }}
                  />
                  <TouchableOpacity
                    style={styles.revealBtn}
                    onPress={() => setShowNew((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? <EyeOff size={20} color={colors.textSec} /> : <Eye size={20} color={colors.textSec} />}
                  </TouchableOpacity>
                </View>
                {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>CONFIRM NEW PASSWORD</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.textInput, styles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMut}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoComplete="password-new"
                    textContentType="newPassword"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity
                    style={styles.revealBtn}
                    onPress={() => setShowConfirm((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff size={20} color={colors.textSec} /> : <Eye size={20} color={colors.textSec} />}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.continueBtn, busy && { opacity: 0.6 }]}
                onPress={submit}
                activeOpacity={0.85}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.continueBtnText}>{t('driver.pwUpdateCta')}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.resendLink} onPress={sendCode} disabled={busy}>
                <Text style={styles.resendText}>{t('auth.resend')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { padding: 24, paddingBottom: 40 },

  hint: { color: colors.textSec, fontSize: 14, lineHeight: 20, marginBottom: 20 },

  inputBlock: { marginBottom: 16 },
  inputLabel: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  textInput: {
    paddingHorizontal: 16, paddingVertical: 16,
    color: colors.text, fontSize: 17,
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  readonlyField: {
    paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  readonlyText: { color: colors.textSec, fontSize: 16 },
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
    marginTop: 8, marginBottom: 16,
  },
  continueBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },

  resendLink: { alignItems: 'center' },
  resendText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
});
