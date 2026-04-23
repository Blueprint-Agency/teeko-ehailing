import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  StatusBar, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../components/driver/ScreenHeader';
import { Colors } from '../../constants/colors';
import profile from '../../data/mock-driver-profile.json';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Malaysia' },
  { code: 'zh', label: '中文' },
  { code: 'ta', label: 'தமிழ்' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [lang, setLang] = useState(profile.language);

  const stars = Math.round(profile.rating);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScreenHeader title="Profile" />

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
              <Text style={styles.statLbl}>Trips</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>Since {new Date(profile.joinedDate).getFullYear()}</Text>
              <Text style={styles.statLbl}>Member</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20', borderColor: Colors.success }]}>
                <Text style={[styles.statusBadgeText, { color: Colors.success }]}>Active</Text>
              </View>
              <Text style={styles.statLbl}>Status</Text>
            </View>
          </View>
        </View>

        {/* Language picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langChip, lang === l.code && styles.langChipActive]}
                onPress={() => setLang(l.code)}
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
          <Text style={styles.sectionTitle}>Account</Text>
          {[
            { label: 'Personal Information', icon: '👤', action: () => Alert.alert('Personal Info', 'Edit personal information') },
            { label: 'Documents', icon: '📄', action: () => router.push('/(driver)/onboarding/personal-docs') },
            { label: 'My Vehicles', icon: '🚗', action: () => router.push('/(driver)/vehicles') },
            { label: 'Bank Account', icon: '🏦', action: () => Alert.alert('Bank', 'Bank account management') },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.settingRow} onPress={item.action}>
              <Text style={styles.settingIcon}>{item.icon}</Text>
              <Text style={styles.settingLabel}>{item.label}</Text>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          {[
            { label: 'Help Center', icon: '❓', action: () => router.push('/(driver)/support') },
            { label: 'Terms & Conditions', icon: '📋', action: () => router.push('/(driver)/onboarding/agreement') },
            { label: 'Privacy Policy', icon: '🔒', action: () => Alert.alert('Privacy', 'Privacy policy') },
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
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Teeko Driver v0.1 · Mockup</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 40 },

  avatarSection: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 3, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: Colors.accent, fontSize: 34, fontWeight: '800' },
  name: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  phone: { color: Colors.textSec, fontSize: 14, marginTop: 4, marginBottom: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  ratingStars: { color: Colors.warning, fontSize: 18 },
  ratingNum: { color: Colors.text, fontSize: 18, fontWeight: '800' },

  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  statLbl: { color: Colors.textSec, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.border },
  statusBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },

  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: {
    color: Colors.textSec, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 8,
  },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  langChipActive: { backgroundColor: 'rgba(204,255,0,0.1)', borderColor: Colors.accent },
  langChipText: { color: Colors.textSec, fontSize: 13, fontWeight: '600' },
  langChipTextActive: { color: Colors.accent },

  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  settingIcon: { fontSize: 18, marginRight: 12 },
  settingLabel: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '600' },
  settingArrow: { color: Colors.textMut, fontSize: 20 },

  logoutBtn: {
    marginHorizontal: 16, marginTop: 4,
    height: 52, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,59,92,0.08)',
  },
  logoutText: { color: Colors.danger, fontSize: 16, fontWeight: '700' },
  version: { color: Colors.textMut, fontSize: 11, textAlign: 'center', marginTop: 20 },
});
