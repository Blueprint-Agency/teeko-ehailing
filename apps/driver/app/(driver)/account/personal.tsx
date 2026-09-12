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
import {
  cooldownSentence,
  describeCooldown,
  formatPhoneDisplay,
  formatUnlockDate,
  parseE164,
  resolveDriverPhone,
} from '@teeko/shared';
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
  // The national number only — the '+60' is a static prefix, never typed.
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  // The OTP sheet opens only once a phone change is actually being asked for;
  // a name-only edit still needs no code.
  const [otpStep, setOtpStep] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [nameError, setNameError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();

  const styles = createStyles(colors);

  const stateOf = (field: ProfileChangeField) => fields.find((f) => f.field === field) ?? null;
  const nameState = stateOf('full_name');
  const phoneState = stateOf('phone');
  // A field is locked while a request is in review or its 30-day window is open.
  const nameLocked = !!nameState?.pending || !!nameState?.nextAllowedAt;
  // Phone is no longer hard-locked by the cooldown. Inside the window the driver
  // may still ask, with a reason — the request is flagged early for the reviewer.
  const phoneEarly = phoneState?.canRequestEarly ?? false;
  const phoneLocked = !!phoneState?.pending;

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
      // The field holds the national number; the '+60' lives in the static
      // prefix, so strip it back off whatever E.164 the server stored.
      setPhone(parseE164(pendingPhone ?? p.phone ?? '', 'MY').nationalNumber);
    } catch {
      Alert.alert('Error', 'Could not load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentNational = parseE164(profile?.phone ?? '', 'MY').nationalNumber;
  const dirtyName = !nameLocked && name.trim() !== (profile?.fullName ?? '');
  const dirtyPhone = !phoneLocked && phone.replace(/\D/g, '') !== currentNational;
  const canSave = (dirtyName || dirtyPhone) && !!name.trim() && !saving;

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  /**
   * Validate, then either submit straight away (name only) or send the code and
   * open the OTP step (anything touching the phone). Splitting it here means a
   * driver never receives a code for an edit that was going to fail validation.
   */
  const onSave = async () => {
    setNameError(undefined);
    setPhoneError(undefined);
    setReasonError(undefined);
    if (!name.trim()) {
      setNameError('Enter your full name.');
      return;
    }

    if (dirtyPhone) {
      const resolved = resolveDriverPhone({ nationalNumber: phone });
      if (!resolved.ok) {
        setPhoneError(
          resolved.error === 'phone_country_not_allowed'
            ? t('phone.countryNotAllowed')
            : resolved.error === 'phone_required'
              ? t('phone.required')
              : t('phone.myMobileOnly'),
        );
        return;
      }
      if (phoneEarly && !reason.trim()) {
        setReasonError(t('phone.reasonRequired'));
        return;
      }
      setSaving(true);
      try {
        await api.auth.sendOtp('phone_change');
        setOtpStep(true);
        setResendIn(60);
      } catch (err) {
        const body = err instanceof ApiError ? err.data : {};
        if (body.error === 'rate_limited') {
          setResendIn(Number(body.retryInSeconds) || 60);
          setOtpStep(true);
        } else {
          Alert.alert('Error', 'Could not send the verification code.');
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    await submit();
  };

  /** The actual PATCH. Carries the OTP only when the phone is part of the edit. */
  const submit = async () => {
    setCodeError(undefined);
    setSaving(true);
    try {
      const { profile: updated, fields: nextFields, results } = await api.profile.update({
        ...(dirtyName ? { fullName: name.trim() } : {}),
        ...(dirtyPhone
          ? {
              phone: phone.trim(),
              otpCode: code,
              ...(phoneEarly ? { reason: reason.trim() } : {}),
            }
          : {}),
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
        else if (r.status === 'invalid') {
          // Never "already taken": numbers are deliberately not unique.
          setFieldError(
            r.field,
            r.error === 'phone_country_not_allowed'
              ? t('phone.countryNotAllowed')
              : t('phone.myMobileOnly'),
          );
        } else if (r.status === 'reason_required') {
          setReasonError(t('phone.reasonRequired'));
        } else if (r.status === 'cooldown') {
          // Name only — the phone's window is an early-request prompt, not a wall.
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
      if (body.error === 'otp_invalid') {
        // The code survives a wrong guess, so the driver retries in place
        // rather than starting the whole edit over.
        setCodeError(
          body.reason === 'expired'
            ? t('phone.otpExpired')
            : body.reason === 'too_many_attempts'
              ? t('phone.tooManyAttempts')
              : body.reason === 'no_active_code'
                ? t('phone.otpNoCode')
                : t('phone.otpInvalid'),
        );
        setCode('');
      } else if (body.error === 'otp_required') {
        setOtpStep(true);
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
      const shown =
        state.field === 'phone'
          ? formatPhoneDisplay(state.pending.requestedValue, state.pending.requestedCountry)
          : state.pending.requestedValue;
      return `“${shown}” is waiting for Teeko to review.`;
    }
    // The phone's window is not a lock — `canRequestEarly` turns it into a
    // prompt for a reason instead, so only say "you can change this again" for
    // a field that really is frozen.
    if (state.nextAllowedAt && !state.canRequestEarly) {
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
              {/* Static prefix, not a picker: a driver's number sits on the
                  APAD/JPJ operator record and must be a Malaysian mobile. */}
              <View style={[styles.phoneRow, phoneError && styles.inputError, phoneLocked && styles.inputLocked]}>
                <Text style={styles.phonePrefix}>+60</Text>
                <View style={styles.phoneDivider} />
                <TextInput
                  style={styles.phoneInput}
                  placeholder="12-345 6789"
                  placeholderTextColor={colors.textMut}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={24}
                  editable={!phoneLocked}
                  value={phone}
                  onChangeText={(v) => { setPhone(v); if (phoneError) setPhoneError(undefined); }}
                />
              </View>
              <Text style={styles.hint}>{t('phone.driverHelper')}</Text>
              {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
              {fieldNotice(phoneState) && <Text style={styles.hint}>{fieldNotice(phoneState)}</Text>}

              {/* Inside the 30-day window the driver is not blocked — they are
                  asked why, and the request reaches the reviewer flagged early. */}
              {phoneEarly && dirtyPhone && !otpStep && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.hint}>{t('phone.driverEarlyNotice')}</Text>
                  <TextInput
                    style={[styles.textInput, reasonError && styles.inputError]}
                    placeholder={t('phone.reasonPlaceholder')}
                    placeholderTextColor={colors.textMut}
                    multiline
                    maxLength={300}
                    value={reason}
                    onChangeText={(v) => { setReason(v); if (reasonError) setReasonError(undefined); }}
                  />
                  {reasonError && <Text style={styles.errorText}>{reasonError}</Text>}
                </View>
              )}

              {phoneState?.pending && (
                <TouchableOpacity onPress={() => onWithdraw('phone')} hitSlop={8}>
                  <Text style={styles.linkText}>{t('phone.withdraw')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {otpStep && (
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>{t('phone.otpTitle')}</Text>
                <Text style={styles.hint}>
                  {t('phone.codeSentTo', { email: maskEmail(profile?.email) })}
                </Text>
                <TextInput
                  style={[styles.textInput, styles.otpInput, codeError && styles.inputError]}
                  placeholder="000000"
                  placeholderTextColor={colors.textMut}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  value={code}
                  onChangeText={(v: string) => { setCode(v.replace(/D/g, '')); if (codeError) setCodeError(undefined); }}
                />
                {codeError && <Text style={styles.errorText}>{codeError}</Text>}
                <TouchableOpacity
                  onPress={resendIn > 0 ? undefined : onSave}
                  disabled={resendIn > 0}
                  hitSlop={8}
                >
                  <Text style={[styles.linkText, resendIn > 0 && { opacity: 0.5 }]}>
                    {resendIn > 0 ? t('phone.resendIn', { seconds: resendIn }) : t('phone.resend')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

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
              style={[styles.saveBtn, (!canSave || (otpStep && code.length !== 6)) && { opacity: 0.5 }]}
              onPress={otpStep ? submit : onSave}
              activeOpacity={0.85}
              disabled={!canSave || (otpStep && code.length !== 6)}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {otpStep || !dirtyPhone ? t('phone.submitForReview') : t('phone.sendCode')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

/** 'ahmad@mail.com' → 'a***@mail.com'. Enough to recognise, not enough to leak. */
function maskEmail(email?: string | null): string {
  if (!email) return 'your email';
  const [local, domain] = email.split('@');
  if (!domain || !local) return email;
  return `${local[0]}***@${domain}`;
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
  inputError: { borderColor: '#ef4444' },
  otpInput: { letterSpacing: 8, fontSize: 24, fontWeight: '700', textAlign: 'center' },
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
