import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useClerk } from '@clerk/clerk-expo';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { api } from '../../lib/api';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const clerk = useClerk();

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const styles = createStyles(colors);
  const autoSentRef = useRef(false);

  useEffect(() => {
    if (autoSentRef.current) return;
    autoSentRef.current = true;
    api.auth.sendOtp().catch(() => {});
  }, []);

  const handleVerify = async () => {
    if (!code.trim()) return;
    setCodeError(undefined);
    setVerifying(true);
    try {
      await api.auth.verifyOtp(code.trim());
      router.replace('/(driver)/(tabs)/home');
    } catch (err: unknown) {
      const body = (() => {
        try { return JSON.parse((err as { body?: string }).body ?? '{}'); } catch { return {}; }
      })();
      if (body.error === 'incorrect' || body.error === 'no_active_code') {
        setCodeError('Invalid code. Please try again.');
      } else if (body.error === 'expired') {
        Alert.alert('Code expired', 'Tap "Resend code" to get a new one.');
      } else if (body.error === 'too_many_attempts') {
        Alert.alert('Too many attempts', 'Tap "Resend code" to get a new one.');
      } else {
        Alert.alert('Error', 'Verification failed. Try again.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.auth.sendOtp();
      Alert.alert('Code sent', 'A new verification code has been sent to your email.');
    } catch {
      Alert.alert('Error', 'Could not resend code. Try again.');
    } finally {
      setResending(false);
    }
  };

  const handleClose = async () => {
    try { await clerk.signOut(); } catch {}
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.backBtn} onPress={handleClose}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.logoBlock}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>T</Text>
            </View>
            <Text style={styles.brand}>teeko</Text>
            <Text style={styles.tagline}>Verify your email</Text>
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>VERIFICATION CODE</Text>
            <Text style={styles.inputHint}>A 6-digit code was sent to your email address.</Text>
            <TextInput
              style={[styles.textInput, styles.otpInput, codeError && styles.inputError]}
              placeholder="123456"
              placeholderTextColor={colors.textMut}
              keyboardType="number-pad"
              value={code}
              onChangeText={(v) => { setCode(v.replace(/\D/g, '')); if (codeError) setCodeError(undefined); }}
              maxLength={6}
              autoFocus
            />
            {codeError && <Text style={styles.errorText}>{codeError}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.continueBtn, (verifying || code.length !== 6) && { opacity: 0.6 }]}
            onPress={handleVerify}
            activeOpacity={0.85}
            disabled={verifying || code.length !== 6}
          >
            {verifying ? <ActivityIndicator color="#000" /> : <Text style={styles.continueBtnText}>Verify Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={handleResend} disabled={resending}>
            {resending
              ? <ActivityIndicator color={colors.accent} />
              : <Text style={styles.linkText}>Didn't receive a code? <Text style={styles.linkAccent}>Resend</Text></Text>}
          </TouchableOpacity>
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
