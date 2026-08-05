import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, ActivityIndicator, AppState,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { Landmark, CheckCircle2, AlertTriangle, Clock } from 'lucide-react-native';
import ScreenHeader from '../../components/driver/ScreenHeader';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { api, type ConnectStatus } from '../../lib/api';

// Stripe Connect onboarding happens in a hosted browser flow. We only ever see
// the resulting account status — no bank details touch the app or our servers.
export default function PayoutsScreen() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  // Set while the driver is away in the Stripe browser flow, so returning to
  // the app re-polls instead of showing the stale pre-onboarding status.
  const awaitingReturn = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setStatus(await api.connect.status());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load payout status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && awaitingReturn.current) {
        awaitingReturn.current = false;
        load();
      }
    });
    return () => sub.remove();
  }, [load]);

  const startOnboarding = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const { onboardingUrl } = await api.connect.onboard();
      awaitingReturn.current = true;
      await Linking.openURL(onboardingUrl);
    } catch (err) {
      awaitingReturn.current = false;
      Alert.alert(
        'Payout setup failed',
        err instanceof Error ? err.message : 'Please try again later.',
      );
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
        <ScreenHeader title={t('driver.bankAccount')} />
        <View style={styles.centre}><ActivityIndicator color={colors.accent} /></View>
      </View>
    );
  }

  const state = status?.status ?? 'not_started';
  const enabled = !!status?.payoutsEnabled;

  const view = enabled
    ? {
        Icon: CheckCircle2,
        tone: colors.success,
        title: 'Payouts active',
        body: 'Your bank account is verified. Trip earnings are transferred to you automatically, and instant cashout is available from the Earnings tab.',
        cta: 'Update bank details',
      }
    : state === 'pending'
      ? {
          Icon: Clock,
          tone: colors.warning,
          title: 'Verification in progress',
          body: 'Stripe is reviewing the details you submitted. This usually takes a few minutes, but can take up to a day.',
          cta: 'Continue setup',
        }
      : state === 'restricted'
        ? {
            Icon: AlertTriangle,
            tone: colors.danger,
            title: 'Action needed',
            body: 'Stripe needs more information before it can pay you. Finish the remaining steps to start receiving earnings.',
            cta: 'Fix now',
          }
        : {
            Icon: Landmark,
            tone: colors.accent,
            title: 'Set up payouts',
            body: 'Add your bank account so Teeko can pay out your trip earnings. Stripe collects and verifies your details securely — Teeko never stores your bank number.',
            cta: 'Set up payouts',
          };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.bankAccount')} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: view.tone + '20', borderColor: view.tone }]}>
            <view.Icon size={28} color={view.tone} strokeWidth={1.75} />
          </View>
          <Text style={styles.title}>{view.title}</Text>
          <Text style={styles.body}>{view.body}</Text>

          <View style={[styles.statusPill, { borderColor: view.tone }]}>
            <Text style={[styles.statusPillText, { color: view.tone }]}>
              {enabled ? 'Payouts enabled' : `Status: ${state.replace('_', ' ')}`}
            </Text>
          </View>

          <TouchableOpacity style={styles.cta} onPress={startOnboarding} disabled={starting}>
            {starting
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.ctaText}>{view.cta}</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.footnote}>
          Payouts are handled by Stripe. You will be taken to a secure Stripe page to enter your
          details, then returned here.
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  body: { color: colors.textSec, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 20,
  },
  statusPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'capitalize' },
  cta: {
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  ctaText: { color: '#000', fontWeight: '800', fontSize: 15 },

  errorText: { color: colors.textSec, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  footnote: { color: colors.textMut, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 16 },
});
