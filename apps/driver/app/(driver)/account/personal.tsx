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
import { cooldownSentence, describeCooldown, formatUnlockDate } from '@teeko/shared';
import {
  ApiError,
  api,
  type DriverProfile,
  type ProfileChangeField,
  type ProfileFieldState,
} from '../../../lib/api';

// Name and phone are the only self-service fields. Everything else on a driver
// profile (licence, vehicle, approval status) is verified evidence for APAD and
// can only change through the web portal's re-verification flow.
//
// Even these two are *requests*: the driver submits, an admin reviews, and only
// an approval writes the value. Each field may then change once every 30 days.
export default function PersonalInfoScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [fields, setFields] = useState<ProfileFieldState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();

  const styles = createStyles(colors);

  const stateOf = (field: ProfileChangeField) => fields.find((f) => f.field === field) ?? null;
  const nameState = stateOf('full_name');
  const phoneState = stateOf('phone');
  // A field is locked while a request is in review or its 30-day window is open.
  const nameLocked = !!nameState?.pending || !!nameState?.nextAllowedAt;
  const phoneLocked = !!phoneState?.pending || !!phoneState?.nextAllowedAt;

  const load = useCallback(async () => {
    try {
      const { profile: p, fields: f } = await api.profile.get();
      setProfile(p);
      setFields(f);
      // Show the value under review, not the stale one, so the driver sees what
      // they asked for rather than being surprised by an apparent reversion.
      const pendingName = f.find((x) => x.field === 'full_name')?.pending?.requestedValue;
      const pendingPhone = f.find((x) => x.field === 'phone')?.pending?.requestedValue;
      setName(pendingName ?? p.fullName ?? '');
      setPhone(pendingPhone ?? p.phone ?? '');
    } catch {
      Alert.alert('Error', 'Could not load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirtyName = !nameLocked && name.trim() !== (profile?.fullName ?? '');
  const dirtyPhone = !phoneLocked && phone.trim() !== (profile?.phone ?? '');
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
      const { profile: updated, fields: nextFields, results } = await api.profile.update({
        ...(dirtyName ? { fullName: name.trim() } : {}),
        ...(dirtyPhone ? { phone: phone.trim() } : {}),
      });
      setProfile(updated);
      setFields(nextFields);

      // A two-field edit can half-succeed, so report per field rather than
      // assuming the whole save went one way.
      const setFieldError = (field: ProfileChangeField, message: string) =>
        (field === 'phone' ? setPhoneError : setNameError)(message);
      let submitted = 0;
      for (const r of results) {
        if (r.status === 'submitted') submitted += 1;
        else if (r.status === 'phone_taken') {
          setFieldError(r.field, 'That number is already linked to another account.');
        } else if (r.status === 'cooldown') {
          setFieldError(r.field, cooldownSentence('change this', r.nextAllowedAt));
        } else if (r.status === 'already_pending') {
          setFieldError(r.field, 'A change to this field is already waiting for review.');
        }
      }

      if (submitted > 0) {
        Alert.alert(
          'Sent for review',
          submitted === 1
            ? 'Your change was sent to Teeko for review. You’ll be notified once it’s approved.'
            : 'Your changes were sent to Teeko for review. You’ll be notified once they’re approved.',
        );
        router.back();
      }
    } catch (err) {
      const body = err instanceof ApiError ? err.data : {};
      if (body.error === 'phone_taken') {
        setPhoneError('That number is already linked to another account.');
      } else {
        Alert.alert('Error', 'Could not submit your changes.');
      }
    } finally {
      setSaving(false);
    }
  };

  /** Withdrawing costs nothing — the cooldown only starts when a change lands. */
  const onWithdraw = (field: ProfileChangeField) => {
    const request = stateOf(field)?.pending;
    if (!request) return;
    Alert.alert('Withdraw request?', 'Your profile will stay as it is now.', [
      { text: 'Keep waiting', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            const { fields: nextFields } = await api.profile.cancelChange(request.id);
            setFields(nextFields);
            if (field === 'phone') setPhone(profile?.phone ?? '');
            else setName(profile?.fullName ?? '');
          } catch {
            // Most likely an admin reviewed it in the meantime — re-read rather
            // than leave the screen showing a request that no longer exists.
            await load();
          }
        },
      },
    ]);
  };

  /** One line under each input explaining why it is (or isn't) editable. */
  const fieldNotice = (state: ProfileFieldState | null): string | null => {
    if (!state) return null;
    if (state.pending) {
      return `“${state.pending.requestedValue}” is waiting for Teeko to review.`;
    }
    if (state.nextAllowedAt) {
      return `Changed recently — you can change this again ${describeCooldown(
        state.nextAllowedAt,
      )} (${formatUnlockDate(state.nextAllowedAt)}).`;
    }
    const last = state.lastDecision;
    if (last?.status === 'rejected') {
      return `Last request was not approved${last.reviewNote ? ` — ${last.reviewNote}` : ''}.`;
    }
    return null;
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
                style={[styles.textInput, nameError && styles.inputError, nameLocked && styles.inputLocked]}
                placeholder="Ahmad bin Ali"
                placeholderTextColor={colors.textMut}
                autoCapitalize="words"
                editable={!nameLocked}
                value={name}
                onChangeText={(v) => { setName(v); if (nameError) setNameError(undefined); }}
              />
              {nameError && <Text style={styles.errorText}>{nameError}</Text>}
              {fieldNotice(nameState) && <Text style={styles.hint}>{fieldNotice(nameState)}</Text>}
              {nameState?.pending && (
                <TouchableOpacity onPress={() => onWithdraw('full_name')} hitSlop={8}>
                  <Text style={styles.linkText}>Withdraw request</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>{t('driver.phoneLabel')}</Text>
              <TextInput
                style={[styles.textInput, phoneError && styles.inputError, phoneLocked && styles.inputLocked]}
                placeholder="+60 12 345 6789"
                placeholderTextColor={colors.textMut}
                keyboardType="phone-pad"
                autoComplete="tel"
                editable={!phoneLocked}
                value={phone}
                onChangeText={(v) => { setPhone(v); if (phoneError) setPhoneError(undefined); }}
              />
              {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
              {fieldNotice(phoneState) && <Text style={styles.hint}>{fieldNotice(phoneState)}</Text>}
              {phoneState?.pending && (
                <TouchableOpacity onPress={() => onWithdraw('phone')} hitSlop={8}>
                  <Text style={styles.linkText}>Withdraw request</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyText}>{profile?.email || '—'}</Text>
              </View>
              <Text style={styles.hint}>{t('driver.emailManagedHint')}</Text>
            </View>

            <Text style={styles.hint}>{t('driver.personalDocsHint')}</Text>
            <Text style={styles.hint}>
              Your name and phone are part of your PSV-D record, so a change is
              reviewed by Teeko before it takes effect. Each can be changed once
              every 30 days.
            </Text>

            <TouchableOpacity
              style={[styles.saveBtn, !canSave && { opacity: 0.5 }]}
              onPress={onSave}
              activeOpacity={0.85}
              disabled={!canSave}
            >
              {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Submit for review</Text>}
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
  // A field in review, or inside its 30-day window, reads as evidently frozen.
  inputLocked: { opacity: 0.6 },
  linkText: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 6 },
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
