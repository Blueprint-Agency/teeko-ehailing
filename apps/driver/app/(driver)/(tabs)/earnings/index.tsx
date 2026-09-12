import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Wallet, Car, Coins, Landmark } from 'lucide-react-native';
import ScreenHeader from '../../../../components/driver/ScreenHeader';
import StatTile from '../../../../components/driver/StatTile';
import EarningsChart from '../../../../components/driver/EarningsChart';
import PeriodSelector from '../../../../components/driver/PeriodSelector';
import { useColors } from '../../../../constants/colors';
import { useTheme } from '../../../../components/ThemeProvider';
import { useT, i18n } from '@teeko/i18n';
import { api, type EarningsPeriod, type EarningsResponse } from '../../../../lib/api';

/**
 * Translation keys that change with the selected window. Keyed rather than
 * pre-translated so the copy re-resolves when the driver switches language.
 */
const PERIOD_KEYS: Record<EarningsPeriod, { hero: string; chart: string; list: string }> = {
  day: { hero: 'driver.heroLabelDay', chart: 'driver.chartTitleDay', list: 'driver.listWindowDay' },
  week: {
    hero: 'driver.heroLabelWeek',
    chart: 'driver.chartTitleWeek',
    list: 'driver.listWindowWeek',
  },
  month: {
    hero: 'driver.heroLabelMonth',
    chart: 'driver.chartTitleMonth',
    list: 'driver.listWindowMonth',
  },
};

type TripFilter = 'all' | 'paid' | 'pending';

const TRIP_FILTERS: Array<{ value: TripFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'driver.filterAll' },
  { value: 'paid', labelKey: 'driver.filterPaidOut' },
  { value: 'pending', labelKey: 'driver.filterPending' },
];

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
  const [period, setPeriod] = useState<EarningsPeriod>('week');
  const [tripFilter, setTripFilter] = useState<TripFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colors = useColors();
  const { activeTheme } = useTheme();
  const router = useRouter();
  const t = useT();
  // Dates render in the driver's language but always on the Malaysian calendar.
  const locale = `${i18n.language}-MY`;
  const styles = createStyles(colors);

  const load = useCallback(async (p: EarningsPeriod) => {
    try {
      setError(null);
      setData(await api.earnings.get(p));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('driver.earningsLoadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSwitching(false);
    }
    // `t` changes identity on a language switch, which re-runs the focus effect
    // and refetches — harmless, and it keeps the fallback message in-language.
  }, [t]);

  // Refetch on focus — earnings change while the driver is on other tabs. The
  // selected period is preserved across focus, so it is refetched as-is.
  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [load, period]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(period);
  }, [load, period]);

  // The previous period's figures stay on screen while the new ones load —
  // blanking the dashboard for a sub-second fetch reads as a glitch.
  const onPeriodChange = useCallback((next: EarningsPeriod) => {
    setSwitching(true);
    setPeriod(next);
  }, []);

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
          <Text style={styles.errorText}>{error ?? t('driver.earningsLoadError')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(period); }}>
            <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { payout, current, trend } = data;
  // `data.period` rather than `period`: while a switch is in flight the state
  // has already moved on, and labelling stale figures with the new window's
  // copy would misreport them.
  const copy = PERIOD_KEYS[data.period];
  const periodTotal = current.netCents / 100;
  const avgPerTrip = current.tripCount > 0 ? periodTotal / current.tripCount : null;

  // Filtering is client-side: the window is already capped server-side, so the
  // whole list is in hand and a round trip per chip tap would be wasteful.
  const visibleTrips =
    tripFilter === 'all'
      ? data.recent
      : data.recent.filter((trip) => (tripFilter === 'paid' ? trip.paidOut : !trip.paidOut));

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
        <PeriodSelector value={period} onChange={onPeriodChange} disabled={switching} />

        {/* Hero card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>{t(copy.hero)}</Text>
          <Text style={styles.heroAmount}>RM {periodTotal.toFixed(2)}</Text>
          <Text style={styles.heroSub}>{t('driver.tripsCompleted', { count: current.tripCount })}</Text>

          {/* The hero figure is what they've *earned* this period. Money already
              sent but not yet credited by the bank would otherwise read as
              missing pay, so it gets its own line; the amount still owed is the
              "Pending payout" tile below. */}
          {payout.inTransitRm > 0 && (
            <View style={styles.inTransitRow}>
              <Text style={styles.inTransitText}>
                {t('driver.onTheWayToBank', { amount: payout.inTransitRm.toFixed(2) })}
                {payout.inTransitArrival
                  ? ` · ${new Date(payout.inTransitArrival).toLocaleDateString(locale, {
                      day: 'numeric',
                      month: 'short',
                    })}`
                  : ''}
              </Text>
            </View>
          )}

          {payout.bankAccountSet ? (
            <Text style={styles.cashoutNote}>
              {t('driver.paidToBankNote', { bank: payout.bankName })}
            </Text>
          ) : (
            // Nothing to pay into yet — the earnings are safe, but they can't be
            // transferred until the driver registers an account.
            <>
              <TouchableOpacity style={styles.cashoutBtn} onPress={() => router.push('/(driver)/payouts')}>
                <Text style={styles.cashoutText}>{t('driver.setUpBankAccount')}</Text>
              </TouchableOpacity>
              <Text style={styles.cashoutNote}>{t('driver.setUpBankAccountNote')}</Text>
            </>
          )}
        </View>

        {/* Stat grid. Trends compare against the same-length window before this
            one; the API sends null where there is no baseline to compare to. */}
        <View style={styles.statGrid}>
          <StatTile
            icon={Wallet}
            tint={colors.accentTint}
            iconColor={colors.accent}
            value={`RM ${periodTotal.toFixed(2)}`}
            label={t('driver.earnings')}
            trendPct={trend.netPct}
            style={styles.statTile}
          />
          <StatTile
            icon={Car}
            tint={colors.infoTint}
            iconColor={colors.info}
            value={String(current.tripCount)}
            label={t('driver.trips')}
            trendPct={trend.tripsPct}
            style={styles.statTile}
          />
          <StatTile
            icon={Coins}
            tint={colors.successTint}
            iconColor={colors.success}
            value={avgPerTrip != null ? `RM ${avgPerTrip.toFixed(2)}` : '—'}
            label={t('driver.avgPerTrip')}
            trendPct={trend.avgPct}
            style={styles.statTile}
          />
          <StatTile
            icon={Landmark}
            tint={colors.warningTint}
            iconColor={colors.warning}
            value={`RM ${payout.pendingRm.toFixed(2)}`}
            label={t('driver.pendingPayout')}
            style={styles.statTile}
          />
        </View>

        <EarningsChart title={t(copy.chart)} columns={data.breakdown} />

        {/* Trip history — the same window as the rest of the screen. */}
        <View style={styles.tripHeader}>
          <Text style={styles.sectionTitle}>
            {t('driver.tripsInWindow', { window: t(copy.list) })}
          </Text>
          <Text style={styles.tripCount}>
            {visibleTrips.length}
            {data.recent.length !== visibleTrips.length ? ` / ${data.recent.length}` : ''}
          </Text>
        </View>

        <View style={styles.filterRow}>
          {TRIP_FILTERS.map((f) => {
            const active = f.value === tripFilter;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.8}
                onPress={() => setTripFilter(f.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(f.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {visibleTrips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {data.recent.length === 0
                ? t('driver.noTripsInPeriod')
                : t('driver.noTripsMatchFilter')}
            </Text>
          </View>
        ) : (
          visibleTrips.map((trip) => (
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
                {/* Only the unpaid state is worth calling out — "paid" is the
                    expected resting state and a badge on every row is noise. */}
                {!trip.paidOut && (
                  <Text style={styles.tripPending}>{t('driver.filterPending')}</Text>
                )}
              </View>
            </View>
          ))
        )}

        {data.recentTruncated && (
          <Text style={styles.truncatedNote}>
            {t('driver.tripsTruncated', { count: data.recent.length })}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => {
  // Shared card treatment: generous radius, hairline border, and a shadow that
  // only renders in the light theme (the dark palette zeroes it out, because a
  // black shadow on a near-black background is invisible anyway).
  const card = {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: colors.shadowColor,
    shadowOpacity: colors.shadowOpacity,
    shadowRadius: colors.shadowRadius,
    shadowOffset: { width: 0, height: 4 },
    elevation: colors.shadowElevation,
  } as const;

  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },

  heroCard: {
    ...card,
    borderRadius: 24,
    padding: 24,
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
    marginTop: 16,
  },
  cashoutText: { color: '#000', fontWeight: '800', fontSize: 15 },
  cashoutNote: { color: colors.textSec, fontSize: 11, marginTop: 8 },

  // The hero card centres its children, so this opts out of that to span the
  // full width and sit as a rule under the headline figure.
  inTransitRow: {
    alignSelf: 'stretch',
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    alignItems: 'center',
  },
  inTransitText: { color: colors.textSec, fontSize: 12, fontWeight: '600' },

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
    ...card,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { color: colors.textSec, fontSize: 13 },

  // Two per row. `48%` rather than flex:1 so the wrap breaks predictably at
  // every second tile regardless of how long a formatted value renders.
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statTile: { width: '48.5%', marginBottom: 12 },

  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  // "3 / 12" while a filter is on, plain count otherwise.
  tripCount: { color: colors.textMut, fontSize: 12, fontWeight: '700' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipActive: { backgroundColor: colors.accentTint, borderColor: colors.accent },
  chipText: { color: colors.textSec, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.accent, fontWeight: '800' },

  truncatedNote: {
    color: colors.textMut,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  tripCard: {
    ...card,
    borderRadius: 16,
    padding: 14,
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
  tripPending: {
    color: colors.warning,
    backgroundColor: colors.warningTint,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  });
};
