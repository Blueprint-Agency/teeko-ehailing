import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '../../../constants/colors';
import { useTheme } from '../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';

const STATUS_STEP_KEYS = [
  { key: 'submitted', labelKey: 'stepSubmitted', done: true, active: false },
  { key: 'review', labelKey: 'stepUnderReview', done: false, active: true },
  { key: 'background', labelKey: 'stepBackground', done: false, active: false },
  { key: 'approved', labelKey: 'stepApproved', done: false, active: false },
] as const;

export default function PendingReviewScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconRing}>
            <Text style={styles.iconEmoji}>🔍</Text>
          </View>

          <Text style={styles.title}>{t('driver.pendingTitle')}</Text>
          <Text style={styles.subtitle}>{t('driver.pendingSubtitle')}</Text>

          {/* Status tracker */}
          <View style={styles.tracker}>
            {STATUS_STEP_KEYS.map((step, i) => (
              <View key={step.key} style={styles.trackRow}>
                <View style={styles.trackLeft}>
                  <View style={[
                    styles.trackDot,
                    step.done && styles.trackDotDone,
                    step.active && styles.trackDotActive,
                  ]}>
                    {step.done && <Text style={styles.trackCheck}>✓</Text>}
                    {step.active && <View style={styles.trackPulse} />}
                  </View>
                  {i < STATUS_STEP_KEYS.length - 1 && (
                    <View style={[styles.trackLine, step.done && styles.trackLineDone]} />
                  )}
                </View>
                <View style={styles.trackContent}>
                  <Text style={[
                    styles.trackLabel,
                    step.done && styles.trackLabelDone,
                    step.active && styles.trackLabelActive,
                  ]}>
                    {t(`driver.${step.labelKey}`)}
                  </Text>
                  {step.active && (
                    <Text style={styles.trackSub}>{t('driver.stepInProgress')}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{t('driver.whatToExpect')}</Text>
            <Text style={styles.infoBody}>{t('driver.whatToExpectBody')}</Text>
          </View>

          <TouchableOpacity
            style={styles.supportBtn}
            onPress={() => router.push('/(driver)/support')}
          >
            <Text style={styles.supportBtnText}>{t('driver.contactSupport')}</Text>
          </TouchableOpacity>

          {/* Dev shortcut */}
          <TouchableOpacity
            style={styles.devBtn}
            onPress={() => router.replace('/(driver)/(tabs)/home')}
          >
            <Text style={styles.devBtnText}>[ Dev ] Skip to Home →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  container: { padding: 24, alignItems: 'center' },

  iconRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.accent + '1A',
    borderWidth: 2, borderColor: colors.accent + '4D',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 32, marginBottom: 20,
  },
  iconEmoji: { fontSize: 40 },

  title: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  subtitle: { color: colors.textSec, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  tracker: { width: '100%', marginBottom: 28 },
  trackRow: { flexDirection: 'row', marginBottom: 0 },
  trackLeft: { alignItems: 'center', width: 36 },
  trackDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  trackDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  trackDotActive: { borderColor: colors.accent, backgroundColor: colors.accent + '1A' },
  trackCheck: { color: '#000', fontWeight: '800', fontSize: 14 },
  trackPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  trackLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.border, marginVertical: 3 },
  trackLineDone: { backgroundColor: colors.success },
  trackContent: { flex: 1, paddingLeft: 14, paddingBottom: 24, justifyContent: 'center' },
  trackLabel: { color: colors.textSec, fontSize: 14, fontWeight: '600' },
  trackLabelDone: { color: colors.success },
  trackLabelActive: { color: colors.accent },
  trackSub: { color: colors.textSec, fontSize: 12, marginTop: 3 },

  infoCard: {
    width: '100%', backgroundColor: colors.surface,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 20,
  },
  infoTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  infoBody: { color: colors.textSec, fontSize: 13, lineHeight: 22 },

  supportBtn: {
    width: '100%', height: 52, borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  supportBtnText: { color: colors.text, fontSize: 15, fontWeight: '700' },

  devBtn: { marginTop: 8 },
  devBtnText: { color: colors.textMut, fontSize: 12 },
});
