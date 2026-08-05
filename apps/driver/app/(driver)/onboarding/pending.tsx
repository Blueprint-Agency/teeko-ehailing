import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, AppState, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useColors } from '../../../constants/colors';
import { useTheme } from '../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { api } from '../../../lib/api';
import { openPortal, portalPathForApplicationState } from '../../../lib/portal';

const STEP_LABEL_KEYS = ['stepSubmitted', 'stepUnderReview', 'stepBackground', 'stepApproved'] as const;

// How far through the 4-step tracker each application state sits. Everything
// before the documents are in counts as "not yet submitted" (index 0 active).
const STEP_INDEX: Record<string, number> = {
  phone_entered: 0,
  agreement_signed: 0,
  personal_docs_submitted: 0,
  vehicle_added: 0,
  vehicle_docs_submitted: 1,
  in_review: 2,
  rejected: 2,
  activated: 4,
};

/** States where the driver still has portal work to do before review starts. */
const NEEDS_PORTAL = new Set([
  'phone_entered',
  'agreement_signed',
  'personal_docs_submitted',
  'vehicle_added',
  'rejected',
]);

export default function PendingReviewScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const [state, setState] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const routed = useRef(false);

  const load = useCallback(async () => {
    try {
      const me = await api.auth.me();
      const next = me.application?.state ?? null;
      setState(next);
      setRejectionReason(me.application?.rejectionReason ?? null);
      // An admin can activate the driver while this screen is open — send them
      // straight to work rather than leaving them staring at a stale tracker.
      if (next === 'activated' && !routed.current) {
        routed.current = true;
        router.replace('/(driver)/(tabs)/home');
      }
    } catch {
      // Keep the last known state on a network blip; the driver can pull to refresh.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Re-check when the driver comes back from the portal in their browser.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  const stepIndex = STEP_INDEX[state ?? ''] ?? 0;
  const needsPortal = NEEDS_PORTAL.has(state ?? '');
  const isRejected = state === 'rejected';

  const steps = STEP_LABEL_KEYS.map((labelKey, i) => ({
    key: labelKey,
    labelKey,
    done: i < stepIndex,
    active: i === stepIndex,
  }));

  const continueInPortal = () => {
    openPortal(portalPathForApplicationState(state)).catch(() =>
      Alert.alert('Could not open browser', 'Please visit the Teeko driver portal to continue.'),
    );
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
        <View style={styles.loadingWrap}><ActivityIndicator color={colors.accent} /></View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

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
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconRing}>
            <Text style={styles.iconEmoji}>{isRejected ? '⚠️' : needsPortal ? '📄' : '🔍'}</Text>
          </View>

          <Text style={styles.title}>
            {isRejected
              ? 'Application needs attention'
              : needsPortal
                ? 'Finish your application'
                : t('driver.pendingTitle')}
          </Text>
          <Text style={styles.subtitle}>
            {isRejected
              ? 'Our team could not approve your application as submitted. Update the details below and resubmit.'
              : needsPortal
                ? 'Your documents are not all in yet. Continue in the driver portal to complete your application.'
                : t('driver.pendingSubtitle')}
          </Text>

          {isRejected && rejectionReason && (
            <View style={styles.rejectCard}>
              <Text style={styles.rejectTitle}>Reason</Text>
              <Text style={styles.rejectBody}>{rejectionReason}</Text>
            </View>
          )}

          {/* Status tracker */}
          <View style={styles.tracker}>
            {steps.map((step, i) => (
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
                  {i < steps.length - 1 && (
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

          {needsPortal && (
            <TouchableOpacity style={styles.portalBtn} onPress={continueInPortal}>
              <Text style={styles.portalBtnText}>
                {isRejected ? 'Update my application' : 'Continue in browser'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.supportBtn}
            onPress={() => router.push('/(driver)/support')}
          >
            <Text style={styles.supportBtnText}>{t('driver.contactSupport')}</Text>
          </TouchableOpacity>

          {/* An unapproved driver has nowhere else to go in-app, so this is their
              only way off this screen — e.g. to sign in as a different account. */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={async () => {
              await signOut();
              router.replace('/(auth)/login');
            }}
          >
            <Text style={styles.signOutBtnText}>{t('driver.signOut')}</Text>
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

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  rejectCard: {
    width: '100%', backgroundColor: colors.danger + '14',
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.danger + '55',
    marginBottom: 24,
  },
  rejectTitle: { color: colors.danger, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6 },
  rejectBody: { color: colors.text, fontSize: 13, lineHeight: 20 },

  portalBtn: {
    width: '100%', height: 52, borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  portalBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },

  supportBtn: {
    width: '100%', height: 52, borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  supportBtnText: { color: colors.text, fontSize: 15, fontWeight: '700' },

  signOutBtn: {
    width: '100%', height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  signOutBtnText: { color: colors.textSec, fontSize: 15, fontWeight: '700' },
});
