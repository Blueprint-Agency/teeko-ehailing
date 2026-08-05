import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import ScreenHeader from '../../../../components/driver/ScreenHeader';
import { useColors } from '../../../../constants/colors';
import { useTheme } from '../../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { api, type EarningsResponse } from '../../../../lib/api';

/** HH:MM in Malaysian time — the server sends UTC ISO strings. */
function timeLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  });
}

export default function EarningsScreen() {
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cashingOut, setCashingOut] = useState(false);
  const colors = useColors();
  const { activeTheme } = useTheme();
  const router = useRouter();
  const t = useT();
  const styles = createStyles(colors);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api.earnings.get());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load earnings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch on focus — earnings change while the driver is on other tabs.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleCashout = async () => {
    if (cashingOut) return;
    setCashingOut(true);
    try {
      const res = await api.earnings.cashout();
      Alert.alert(
        t('driver.earlyCashout'),
        `RM ${res.amountRm.toFixed(2)} is on its way to your bank account.`,
      );
      await load();
    } catch (err) {
      Alert.alert(
        'Cashout failed',
        err instanceof Error ? err.message : 'Please try again later.',
      );
    } finally {
      setCashingOut(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
        <ScreenHeader title={t('driver.earnings')} />
        <View style={styles.centre}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
        <ScreenHeader title={t('driver.earnings')} />
        <View style={styles.centre}>
          <Text style={styles.errorText}>{error ?? 'Could not load earnings.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const barMax = Math.max(...data.dailyBreakdown.map((d) => d.amountRm), 0);
  const weekTotal = data.week.netCents / 100;
  const todayTotal = data.today.netCents / 100;
  const { cashout } = data;

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.earnings')} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>{t('driver.thisWeek')}</Text>
          <Text style={styles.heroAmount}>RM {weekTotal.toFixed(2)}</Text>
          <Text style={styles.heroSub}>{t('driver.tripsCompleted', { count: data.week.tripCount })}</Text>

          {cashout.payoutsEnabled ? (
            <TouchableOpacity
              style={[styles.cashoutBtn, (!cashout.eligible || cashingOut) && styles.cashoutBtnDisabled]}
              disabled={!cashout.eligible || cashingOut}
              onPress={handleCashout}
            >
              {cashingOut
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.cashoutText}>{t('driver.earlyCashout')}</Text>}
            </TouchableOpacity>
          ) : (
            // No Connect account yet — cashout is impossible, so send them to setup.
            <TouchableOpacity style={styles.cashoutBtn} onPress={() => router.push('/(driver)/payouts')}>
              <Text style={styles.cashoutText}>Set up payouts</Text>
            </TouchableOpacity>
          )}
          {cashout.payoutsEnabled && cashout.cooldownHoursLeft > 0 && (
            <Text style={styles.cashoutNote}>
              Next cashout available in {cashout.cooldownHoursLeft}h
            </Text>
          )}
        </View>

        {/* Today card */}
        <View style={styles.todayCard}>
          <View style={styles.todayRow}>
            <View>
              <Text style={styles.todayLabel}>{t('driver.todaysEarnings')}</Text>
              <Text style={styles.todayAmount}>RM {todayTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.todayTrips}>
              <Text style={styles.todayTripsNum}>{data.today.tripCount}</Text>
              <Text style={styles.todayTripsLabel}>{t('driver.trips')}</Text>
            </View>
          </View>
        </View>

        {/* Bar chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{t('driver.last7Days')}</Text>
          <View style={styles.barsContainer}>
            {data.dailyBreakdown.map((d) => {
              const heightPct = barMax > 0 ? (d.amountRm / barMax) * 100 : 0;
              return (
                <View key={d.date} style={styles.barColumn}>
                  <Text style={styles.barAmt}>
                    {d.amountRm > 0 ? `${d.amountRm.toFixed(0)}` : ''}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { height: `${heightPct}%` },
                        d.isToday && styles.barFillActive,
                      ]}
                    />
                  </View>
                  <Text style={[styles.barDay, d.isToday && styles.barDayActive]}>{d.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Trip history */}
        <Text style={styles.sectionTitle}>{t('driver.todaysTrips')}</Text>
        {data.recent.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No completed trips yet.</Text>
          </View>
        ) : (
          data.recent.map((trip) => (
            <View key={trip.tripId} style={styles.tripCard}>
              <View style={styles.tripLeft}>
                <Text style={styles.tripTime}>{timeLabel(trip.completedAt ?? trip.at)}</Text>
                <View style={styles.tripRoute}>
                  <Text style={styles.tripFrom} numberOfLines={1}>{trip.pickupAddress ?? '—'}</Text>
                  <Text style={styles.tripArrow}>→</Text>
                  <Text style={styles.tripTo} numberOfLines={1}>{trip.dropoffAddress ?? '—'}</Text>
                </View>
                <Text style={styles.tripMeta}>
                  {[
                    trip.distanceKm != null ? `${trip.distanceKm.toFixed(1)} km` : null,
                    trip.riderName,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.tripRight}>
                <Text style={styles.tripFare}>RM {trip.netRm.toFixed(2)}</Text>
                {trip.ratingGiven != null && (
                  <Text style={styles.tripRating}>{'★'.repeat(trip.ratingGiven)}</Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },

  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    alignItems: 'center',
  },
  heroLabel: { color: colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  heroAmount: { color: colors.accent, fontSize: 44, fontWeight: '800', letterSpacing: -1 },
  heroSub: { color: colors.textSec, fontSize: 13, marginTop: 4, marginBottom: 16 },
  cashoutBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cashoutBtnDisabled: { opacity: 0.4 },
  cashoutText: { color: '#000', fontWeight: '800', fontSize: 15 },
  cashoutNote: { color: colors.textSec, fontSize: 11, marginTop: 8 },

  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  errorText: { color: colors.textSec, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyText: { color: colors.textSec, fontSize: 13 },

  todayCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  todayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayLabel: { color: colors.textSec, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  todayAmount: { color: colors.text, fontSize: 28, fontWeight: '800' },
  todayTrips: { alignItems: 'center' },
  todayTripsNum: { color: colors.text, fontSize: 32, fontWeight: '800' },
  todayTripsLabel: { color: colors.textSec, fontSize: 12 },

  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  chartTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 16 },
  barsContainer: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    gap: 6,
  },
  barColumn: { flex: 1, alignItems: 'center' },
  barAmt: { color: colors.textSec, fontSize: 9, marginBottom: 4 },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: colors.surfaceTop, borderRadius: 4 },
  barFillActive: { backgroundColor: colors.accent },
  barDay: { color: colors.textSec, fontSize: 10, marginTop: 6, fontWeight: '600' },
  barDayActive: { color: colors.accent },

  sectionTitle: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripLeft: { flex: 1 },
  tripTime: { color: colors.textSec, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  tripRoute: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  tripFrom: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  tripArrow: { color: colors.textMut, fontSize: 12 },
  tripTo: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  tripMeta: { color: colors.textSec, fontSize: 11 },
  tripRight: { alignItems: 'flex-end', marginLeft: 12 },
  tripFare: { color: colors.text, fontSize: 16, fontWeight: '800' },
  tripRating: { color: colors.warning, fontSize: 11, marginTop: 2 },
});
