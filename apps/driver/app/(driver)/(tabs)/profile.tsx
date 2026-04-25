import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import { useColors } from '../../../constants/colors';
import { useTheme, ThemeType } from '../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { useLocale } from '../../../providers/LocaleProvider';
import type { Locale } from '@teeko/shared';
import profile from '../../../data/mock-driver-profile.json';

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
  const colors = useColors();
  const { theme, setTheme, activeTheme } = useTheme();
  const t = useT();
  const { locale, changeLocale } = useLocale();
  const [lang, setLang] = useState<string>(locale);

  const stars = Math.round(profile.rating);
  const styles = createStyles(colors);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.profile')} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.phone}>{profile.phone}</Text>

          <View style={styles.ratingRow}>
            <Text style={styles.ratingStars}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</Text>
            <Text style={styles.ratingNum}>{profile.rating}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{profile.totalTrips.toLocaleString()}</Text>
              <Text style={styles.statLbl}>{t('driver.trips')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{t('driver.since', { year: new Date(profile.joinedDate).getFullYear() })}</Text>
              <Text style={styles.statLbl}>{t('driver.member')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statusBadge, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
                <Text style={[styles.statusBadgeText, { color: colors.success }]}>{t('driver.active')}</Text>
              </View>
              <Text style={styles.statLbl}>{t('driver.status')}</Text>
            </View>
          </View>
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
          {[
            { label: t('driver.personalInfo'), icon: '👤', action: () => Alert.alert(t('driver.personalInfo'), 'Edit personal information') },
            { label: t('driver.documents'), icon: '📄', action: () => router.push('/(driver)/onboarding/personal-docs') },
            { label: t('driver.myVehicles'), icon: '🚗', action: () => router.push('/(driver)/(tabs)/vehicles') },
            { label: t('driver.bankAccount'), icon: '🏦', action: () => Alert.alert(t('driver.bankAccount'), 'Bank account management') },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.settingRow} onPress={item.action}>
              <Text style={styles.settingIcon}>{item.icon}</Text>
              <Text style={styles.settingLabel}>{item.label}</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.support')}</Text>
          {[
            { label: t('driver.helpCenter'), icon: '❓', action: () => router.push('/(driver)/support') },
            { label: t('driver.terms'), icon: '📋', action: () => router.push('/(driver)/onboarding/agreement') },
            { label: t('driver.privacy'), icon: '🔒', action: () => Alert.alert(t('driver.privacy'), 'Privacy policy') },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.settingRow} onPress={item.action}>
              <Text style={styles.settingIcon}>{item.icon}</Text>
              <Text style={styles.settingLabel}>{item.label}</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => router.replace('/(auth)/login')}
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

  avatarSection: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 3, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
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
  settingIcon: { fontSize: 18, marginRight: 12 },
  settingLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  settingArrow: { color: colors.textMut, fontSize: 20 },

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
