import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  StatusBar, ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { User, FileText, Car, Landmark, HelpCircle, ClipboardList, Lock, ChevronRight, LogOut, Camera } from 'lucide-react-native';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import { useColors } from '../../../constants/colors';
import { useTheme, ThemeType } from '../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { useLocale } from '../../../providers/LocaleProvider';
import { openPortal } from '../../../lib/portal';
import type { Locale } from '@teeko/shared';
import { api, resolveMediaUrl, type DriverProfile } from '../../../lib/api';
import { pickProfileImage, PermissionDeniedError } from '../../../lib/pickProfileImage';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Malaysia' },
  { code: 'zh', label: '中文' },
  { code: 'ta', label: 'தமிழ்' },
];

const THEMES: { code: ThemeType; label: string }[] = [
  { code: 'light', label: 'Light' },
  { code: 'dark', label: 'Dark' },
  { code: 'system', label: 'System' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const colors = useColors();
  const { theme, setTheme, activeTheme } = useTheme();
  const t = useT();
  const { locale, changeLocale } = useLocale();
  const [lang, setLang] = useState<string>(locale);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.profile.get();
      setProfile(res.profile);
    } catch {
      // Leave the last known profile in place; the settings below still work
      // offline, so a failed fetch shouldn't block the whole screen.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // The picture is written straight to the profile — it carries no compliance
  // weight, so it does not go through the name/phone review queue.
  const changeAvatar = useCallback(async (source: 'camera' | 'library') => {
    setAvatarBusy(true);
    try {
      const picked = await pickProfileImage(source);
      if (!picked) return; // user backed out of the picker
      const avatarUrl = await api.profile.uploadAvatar(picked);
      setProfile((prev) => (prev ? { ...prev, avatarUrl } : prev));
    } catch (err) {
      Alert.alert(
        t('driver.photoFailedTitle'),
        err instanceof PermissionDeniedError
          ? t('driver.photoPermissionDenied')
          : t('driver.photoFailedBody'),
      );
    } finally {
      setAvatarBusy(false);
    }
  }, [t]);

  const removeAvatar = useCallback(async () => {
    setAvatarBusy(true);
    try {
      await api.profile.removeAvatar();
      setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
    } catch {
      Alert.alert(t('driver.photoFailedTitle'), t('driver.photoFailedBody'));
    } finally {
      setAvatarBusy(false);
    }
  }, [t]);

  const onAvatarPress = useCallback(() => {
    if (avatarBusy) return;
    Alert.alert(t('driver.profilePhoto'), undefined, [
      { text: t('driver.takePhoto'), onPress: () => void changeAvatar('camera') },
      { text: t('driver.chooseFromLibrary'), onPress: () => void changeAvatar('library') },
      ...(profile?.avatarUrl
        ? [{ text: t('driver.removePhoto'), style: 'destructive' as const, onPress: () => void removeAvatar() }]
        : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }, [avatarBusy, changeAvatar, profile?.avatarUrl, removeAvatar, t]);

  const styles = createStyles(colors);
  const avatarSrc = resolveMediaUrl(profile?.avatarUrl);

  // Null rating means "not rated yet" — show a dash, never a made-up score.
  const stars = profile?.rating != null ? Math.round(profile.rating) : 0;
  const displayName = profile?.fullName?.trim() || '—';

  const STATUS_LABEL: Record<string, string> = {
    active: t('driver.active'),
    suspended: t('driver.statusSuspended'),
    deactivated: t('driver.statusDeactivated'),
    pending: t('driver.statusPending'),
  };
  const STATUS_COLOR: Record<string, string> = {
    active: colors.success,
    suspended: colors.danger,
    deactivated: colors.danger,
    pending: colors.warning,
  };
  // The account is only truly "active" once onboarding approved it too.
  const accountState =
    profile == null
      ? 'pending'
      : profile.status !== 'active'
        ? profile.status
        : profile.approvalStatus === 'approved'
          ? 'active'
          : profile.approvalStatus;
  const stateColor = STATUS_COLOR[accountState] ?? colors.warning;

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.profile')} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.accent}
          />
        }
      >
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          {loading && !profile ? (
            <ActivityIndicator color={colors.accent} style={styles.headerLoader} />
          ) : (
            <>
              <TouchableOpacity
                onPress={onAvatarPress}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('driver.profilePhoto')}
                style={styles.avatarWrap}
              >
                <View style={styles.avatar}>
                  {avatarSrc ? (
                    <Image source={{ uri: avatarSrc }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{displayName.charAt(0)}</Text>
                  )}
                  {avatarBusy ? (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator color={colors.accent} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.avatarBadge}>
                  <Camera size={14} color={colors.bg} strokeWidth={2} />
                </View>
              </TouchableOpacity>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.phone}>{profile?.phone ?? profile?.email ?? ''}</Text>

              <View style={styles.ratingRow}>
                <Text style={styles.ratingStars}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</Text>
                <Text style={styles.ratingNum}>
                  {profile?.rating != null ? profile.rating.toFixed(2) : '—'}
                </Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{(profile?.totalTrips ?? 0).toLocaleString()}</Text>
                  <Text style={styles.statLbl}>{t('driver.trips')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>
                    {profile ? t('driver.since', { year: new Date(profile.joinedAt).getFullYear() }) : '—'}
                  </Text>
                  <Text style={styles.statLbl}>{t('driver.member')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <View style={[styles.statusBadge, { backgroundColor: stateColor + '20', borderColor: stateColor }]}>
                    <Text style={[styles.statusBadgeText, { color: stateColor }]}>
                      {STATUS_LABEL[accountState] ?? accountState}
                    </Text>
                  </View>
                  <Text style={styles.statLbl}>{t('driver.status')}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.appearance')}</Text>
          <View style={styles.langGrid}>
            {THEMES.map((t) => (
              <TouchableOpacity
                key={t.code}
                style={[styles.langChip, theme === t.code && styles.langChipActive]}
                onPress={() => setTheme(t.code)}
              >
                <Text style={[styles.langChipText, theme === t.code && styles.langChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Language picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.language')}</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langChip, lang === l.code && styles.langChipActive]}
                onPress={() => { setLang(l.code); changeLocale(l.code as Locale); }}
              >
                <Text style={[styles.langChipText, lang === l.code && styles.langChipTextActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Settings rows */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.account')}</Text>
          {([
            { label: t('driver.personalInfo'), Icon: User, action: () => router.push('/(driver)/account/personal') },
            // Documents are uploaded and re-verified in the web portal only.
            { label: t('driver.documents'), Icon: FileText, action: () => openPortal('/profile') },
            { label: t('driver.myVehicle'), Icon: Car, action: () => router.push('/(driver)/(tabs)/vehicles') },
            { label: t('driver.bankAccount'), Icon: Landmark, action: () => router.push('/(driver)/payouts') },
            { label: t('driver.changePassword'), Icon: Lock, action: () => router.push('/(driver)/account/change-password') },
          ] as const).map((item) => (
            <TouchableOpacity key={item.label} style={styles.settingRow} onPress={item.action}>
              <item.Icon size={18} color={colors.textSec} strokeWidth={1.75} style={styles.settingIconView} />
              <Text style={styles.settingLabel}>{item.label}</Text>
              <ChevronRight size={18} color={colors.textMut} strokeWidth={1.75} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.support')}</Text>
          {([
            { label: t('driver.helpCenter'), Icon: HelpCircle, action: () => router.push('/(driver)/support') },
            { label: t('driver.terms'), Icon: ClipboardList, action: () => router.push('/(driver)/onboarding/agreement') },
            { label: t('driver.privacy'), Icon: Lock, action: () => Alert.alert(t('driver.privacy'), 'Privacy policy') },
          ] as const).map((item) => (
            <TouchableOpacity key={item.label} style={styles.settingRow} onPress={item.action}>
              <item.Icon size={18} color={colors.textSec} strokeWidth={1.75} style={styles.settingIconView} />
              <Text style={styles.settingLabel}>{item.label}</Text>
              <ChevronRight size={18} color={colors.textMut} strokeWidth={1.75} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => { await signOut(); router.replace('/(auth)/login'); }}
        >
          <Text style={styles.logoutText}>{t('driver.signOut')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Teeko Driver v0.1 · Mockup</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },

  // Roughly the height of the loaded header, so the screen doesn't jump.
  headerLoader: { height: 180 },

  avatarSection: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  avatarWrap: { marginBottom: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 3, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg + 'AA',
  },
  // Sits on the ring rather than inside it, so it never covers the face.
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.accent,
    borderWidth: 2, borderColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontSize: 34, fontWeight: '800' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  phone: { color: colors.textSec, fontSize: 14, marginTop: 4, marginBottom: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  ratingStars: { color: colors.warning, fontSize: 18 },
  ratingNum: { color: colors.text, fontSize: 18, fontWeight: '800' },

  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { color: colors.text, fontSize: 15, fontWeight: '700' },
  statLbl: { color: colors.textSec, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },
  statusBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },

  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: {
    color: colors.textSec, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 8,
  },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  langChipActive: { backgroundColor: colors.accent + '15', borderColor: colors.accent },
  langChipText: { color: colors.textSec, fontSize: 13, fontWeight: '600' },
  langChipTextActive: { color: colors.accent },

  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  settingIconView: { marginRight: 12 },
  settingLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },

  logoutBtn: {
    marginHorizontal: 16, marginTop: 4,
    height: 52, borderRadius: 14,
    borderWidth: 1, borderColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.danger + '15',
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
  version: { color: colors.textMut, fontSize: 11, textAlign: 'center', marginTop: 20 },
});
