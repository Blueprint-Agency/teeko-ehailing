import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../../constants/colors';

const STATUS_STEPS = [
  { key: 'submitted', label: 'Application Submitted', done: true, active: false },
  { key: 'review', label: 'Under Review', done: false, active: true },
  { key: 'background', label: 'Background Check', done: false, active: false },
  { key: 'approved', label: 'Account Approved', done: false, active: false },
];

export default function PendingReviewScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={styles.container}>
        {/* Icon */}
        <View style={styles.iconRing}>
          <Text style={styles.iconEmoji}>🔍</Text>
        </View>

        <Text style={styles.title}>Application Under Review</Text>
        <Text style={styles.subtitle}>
          Our team is reviewing your documents. You'll receive a notification once your account is approved — typically within 1–3 business days.
        </Text>

        {/* Status tracker */}
        <View style={styles.tracker}>
          {STATUS_STEPS.map((step, i) => (
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
                {i < STATUS_STEPS.length - 1 && (
                  <View style={[styles.trackLine, step.done && styles.trackLineDone]} />
                )}
              </View>
              <View style={styles.trackContent}>
                <Text style={[
                  styles.trackLabel,
                  step.done && styles.trackLabelDone,
                  step.active && styles.trackLabelActive,
                ]}>
                  {step.label}
                </Text>
                {step.active && (
                  <Text style={styles.trackSub}>In progress · Est. 1–3 business days</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What to expect</Text>
          <Text style={styles.infoBody}>
            • You'll receive an SMS and app notification when approved{'\n'}
            • If any document is rejected, you'll be notified with details{'\n'}
            • You can re-upload documents at any time from your profile
          </Text>
        </View>

        <TouchableOpacity
          style={styles.supportBtn}
          onPress={() => router.push('/(driver)/support')}
        >
          <Text style={styles.supportBtnText}>Contact Support</Text>
        </TouchableOpacity>

        {/* Dev shortcut */}
        <TouchableOpacity
          style={styles.devBtn}
          onPress={() => router.replace('/(driver)/home')}
        >
          <Text style={styles.devBtnText}>[ Dev ] Skip to Home →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: 24, alignItems: 'center' },

  iconRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(204,255,0,0.1)',
    borderWidth: 2, borderColor: 'rgba(204,255,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 32, marginBottom: 20,
  },
  iconEmoji: { fontSize: 40 },

  title: { color: Colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  subtitle: { color: Colors.textSec, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  tracker: { width: '100%', marginBottom: 28 },
  trackRow: { flexDirection: 'row', marginBottom: 0 },
  trackLeft: { alignItems: 'center', width: 36 },
  trackDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  trackDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  trackDotActive: { borderColor: Colors.accent, backgroundColor: 'rgba(204,255,0,0.1)' },
  trackCheck: { color: '#000', fontWeight: '800', fontSize: 14 },
  trackPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  trackLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: Colors.border, marginVertical: 3 },
  trackLineDone: { backgroundColor: Colors.success },
  trackContent: { flex: 1, paddingLeft: 14, paddingBottom: 24, justifyContent: 'center' },
  trackLabel: { color: Colors.textSec, fontSize: 14, fontWeight: '600' },
  trackLabelDone: { color: Colors.success },
  trackLabelActive: { color: Colors.accent },
  trackSub: { color: Colors.textSec, fontSize: 12, marginTop: 3 },

  infoCard: {
    width: '100%', backgroundColor: Colors.surface,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 20,
  },
  infoTitle: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  infoBody: { color: Colors.textSec, fontSize: 13, lineHeight: 22 },

  supportBtn: {
    width: '100%', height: 52, borderRadius: 14,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  supportBtnText: { color: Colors.text, fontSize: 15, fontWeight: '700' },

  devBtn: { marginTop: 8 },
  devBtnText: { color: Colors.textMut, fontSize: 12 },
});
