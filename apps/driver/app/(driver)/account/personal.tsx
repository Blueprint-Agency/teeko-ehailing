import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import { useColors } from '../../../constants/colors';
import { useTheme } from '../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { ApiError, api, type DriverProfile } from '../../../lib/api';

// Name and phone are the only self-service fields. Everything else on a driver
// profile (licence, vehicle, approval status) is verified evidence for APAD and
// can only change through the web portal's re-verification flow.
export default function PersonalInfoScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();

  const styles = createStyles(colors);

  const load = useCallback(async () => {
    try {
      const { profile: p } = await api.profile.get();
      setProfile(p);
      setName(p.fullName ?? '');
      setPhone(p.phone ?? '');
    } catch {
      Alert.alert('Error', 'Could not load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirtyName = name.trim() !== (profile?.fullName ?? '');
  const dirtyPhone = phone.trim() !== (profile?.phone ?? '');
  const canSave = (dirtyName || dirtyPhone) && !!name.trim() && !saving;

  const onSave = async () => {
    setNameError(undefined);
    setPhoneError(undefined);
    if (!name.trim()) {
      setNameError('Enter your full name.');
      return;
    }
    setSaving(true);
    try {
      const { profile: updated } = await api.profile.update({
        ...(dirtyName ? { fullName: name.trim() } : {}),
        ...(dirtyPhone ? { phone: phone.trim() } : {}),
      });
      setProfile(updated);
      Alert.alert(t('driver.personalInfo'), t('driver.personalSaved'));
      router.back();
    } catch (err) {
      const body = err instanceof ApiError ? err.data : {};
      if (body.error === 'phone_taken') {
        setPhoneError('That number is already linked to another account.');
      } else {
        Alert.alert('Error', 'Could not save your changes.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.personalInfo')} onBack={() => router.back()} />

      {loading ? (
        <View style={styles.centre}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>{t('driver.fullNameLabel')}</Text>
              <TextInput
                style={[styles.textInput, nameError && styles.inputError]}
                placeholder="Ahmad bin Ali"
                placeholderTextColor={colors.textMut}
                autoCapitalize="words"
                value={name}
                onChangeText={(v) => { setName(v); if (nameError) setNameError(undefined); }}
              />
              {nameError && <Text style={styles.errorText}>{nameError}</Text>}
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>{t('driver.phoneLabel')}</Text>
              <TextInput
                style={[styles.textInput, phoneError && styles.inputError]}
                placeholder="+60 12 345 6789"
                placeholderTextColor={colors.textMut}
                keyboardType="phone-pad"
                autoComplete="tel"
                value={phone}
                onChangeText={(v) => { setPhone(v); if (phoneError) setPhoneError(undefined); }}
              />
              {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyText}>{profile?.email || '—'}</Text>
              </View>
              <Text style={styles.hint}>{t('driver.emailManagedHint')}</Text>
            </View>

            <Text style={styles.hint}>{t('driver.personalDocsHint')}</Text>

            <TouchableOpacity
              style={[styles.saveBtn, !canSave && { opacity: 0.5 }]}
              onPress={onSave}
              activeOpacity={0.85}
              disabled={!canSave}
            >
              {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{t('driver.saveChanges')}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 24, paddingBottom: 40 },

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
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  hint: { color: colors.textMut, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 10 },

  saveBtn: {
    height: 58, borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },
});
