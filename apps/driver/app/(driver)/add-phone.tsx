import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { resolveDriverPhone } from '@teeko/shared';
import { useT } from '@teeko/i18n';

import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { api } from '../../lib/api';

// The R6 gate: an account that predates required-phone-at-registration, or one
// whose sign-up was interrupted between the Clerk step and the number write.
//
// Deliberately blocking — no back button, no skip. A NULL phone silently
// degrades a trip: the rider's in-trip call button has nothing to dial, and the
// number is part of the APAD/JPJ operator record.
//
// No OTP: there is no existing number to protect. The server refuses to
// overwrite an existing number here, so this is not a route around the review
// queue — a driver who already has a number must go through it.
export default function AddPhoneScreen({ onSaved }: { onSaved?: () => void }) {
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();

  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const styles = createStyles(colors);

  const submit = async () => {
    setError(undefined);
    const resolved = resolveDriverPhone({ nationalNumber: phone });
    if (!resolved.ok) {
      setError(
        resolved.error === 'phone_country_not_allowed'
          ? t('phone.countryNotAllowed')
          : resolved.error === 'phone_required'
            ? t('phone.required')
            : t('phone.myMobileOnly'),
      );
      return;
    }

    setSaving(true);
    try {
      await api.auth.setInitialPhone(phone.trim());
      // The gate keys off `me().user.phone`, so a re-read is what dismisses
      // this screen — there is nothing to navigate to.
      onSaved?.();
    } catch {
      Alert.alert('Error', 'Could not save your number. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('phone.addTitle')}</Text>
          <Text style={styles.body}>{t('phone.addBodyDriver')}</Text>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>PHONE</Text>
            <View style={[styles.phoneRow, !!error && styles.inputError]}>
              <Text style={styles.phonePrefix}>+60</Text>
              <View style={styles.phoneDivider} />
              <TextInput
                style={styles.phoneInput}
                placeholder="12-345 6789"
                placeholderTextColor={colors.textMut}
                keyboardType="phone-pad"
                autoComplete="tel"
                autoFocus
                maxLength={24}
                value={phone}
                onChangeText={(v) => { setPhone(v); if (error) setError(undefined); }}
              />
            </View>
            <Text style={styles.hint}>{t('phone.driverHelper')}</Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={submit}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.saveBtnText}>{t('phone.addCta')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { padding: 24, paddingTop: 80, paddingBottom: 40 },

  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  body: { color: colors.textSec, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 28 },

  inputBlock: { marginBottom: 16 },
  inputLabel: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  phonePrefix: { color: colors.text, fontSize: 17, fontWeight: '600' },
  phoneDivider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: 12 },
  phoneInput: { flex: 1, paddingVertical: 16, color: colors.text, fontSize: 17 },
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  hint: { color: colors.textMut, fontSize: 12, lineHeight: 18, marginTop: 6 },

  saveBtn: {
    height: 58, borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },
});
