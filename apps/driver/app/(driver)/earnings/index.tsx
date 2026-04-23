import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  StatusBar, ScrollView, Alert,
} from 'react-native';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import { Colors } from '../../../constants/colors';
import earnings from '../../../data/mock-earnings.json';
import trips from '../../../data/mock-trips-driver.json';

const BAR_MAX = Math.max(...earnings.dailyBreakdown.map((d) => d.amount));

export default function EarningsScreen() {
  const [tab, setTab] = useState<'today' | 'week'>('today');

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScreenHeader title="Earnings" />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>THIS WEEK</Text>
          <Text style={styles.heroAmount}>RM {earnings.weeklyTotal.toFixed(2)}</Text>
          <Text style={styles.heroSub}>{earnings.weeklyTrips} trips completed</Text>

          {earnings.cashoutEligible && (
            <TouchableOpacity
              style={styles.cashoutBtn}
              onPress={() => Alert.alert('Early Cashout', 'Funds will be transferred within 2 hours.')}
            >
              <Text style={styles.cashoutText}>⚡ Early Cashout</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Today card */}
        <View style={styles.todayCard}>
          <View style={styles.todayRow}>
            <View>
              <Text style={styles.todayLabel}>Today's Earnings</Text>
              <Text style={styles.todayAmount}>RM {earnings.todayTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.todayTrips}>
              <Text style={styles.todayTripsNum}>{earnings.todayTrips}</Text>
              <Text style={styles.todayTripsLabel}>Trips</Text>
            </View>
          </View>
        </View>

        {/* Bar chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Last 7 Days</Text>
          <View style={styles.barsContainer}>
            {earnings.dailyBreakdown.map((d) => {
              const heightPct = BAR_MAX > 0 ? (d.amount / BAR_MAX) * 100 : 0;
              const isToday = d.day === 'Sat';
              return (
                <View key={d.day} style={styles.barColumn}>
                  <Text style={styles.barAmt}>
                    {d.amount > 0 ? `${d.amount.toFixed(0)}` : ''}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { height: `${heightPct}%` },
                        isToday && styles.barFillActive,
                      ]}
                    />
                  </View>
                  <Text style={[styles.barDay, isToday && styles.barDayActive]}>{d.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Trip history */}
        <Text style={styles.sectionTitle}>Today's Trips</Text>
        {trips.map((trip) => (
          <View key={trip.id} style={styles.tripCard}>
            <View style={styles.tripLeft}>
              <Text style={styles.tripTime}>{trip.time}</Text>
              <View style={styles.tripRoute}>
                <Text style={styles.tripFrom} numberOfLines={1}>{trip.pickup}</Text>
                <Text style={styles.tripArrow}>→</Text>
                <Text style={styles.tripTo} numberOfLines={1}>{trip.destination}</Text>
              </View>
              <Text style={styles.tripMeta}>{trip.distance} km · {trip.riderName}</Text>
            </View>
            <View style={styles.tripRight}>
              <Text style={styles.tripFare}>RM {trip.fare.toFixed(2)}</Text>
              <Text style={styles.tripRating}>{'★'.repeat(trip.ratingGiven)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },

  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    alignItems: 'center',
  },
  heroLabel: { color: Colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  heroAmount: { color: Colors.accent, fontSize: 44, fontWeight: '800', letterSpacing: -1 },
  heroSub: { color: Colors.textSec, fontSize: 13, marginTop: 4, marginBottom: 16 },
  cashoutBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cashoutText: { color: '#000', fontWeight: '800', fontSize: 15 },

  todayCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  todayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayLabel: { color: Colors.textSec, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  todayAmount: { color: Colors.text, fontSize: 28, fontWeight: '800' },
  todayTrips: { alignItems: 'center' },
  todayTripsNum: { color: Colors.text, fontSize: 32, fontWeight: '800' },
  todayTripsLabel: { color: Colors.textSec, fontSize: 12 },

  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  chartTitle: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 16 },
  barsContainer: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    gap: 6,
  },
  barColumn: { flex: 1, alignItems: 'center' },
  barAmt: { color: Colors.textSec, fontSize: 9, marginBottom: 4 },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: Colors.surfaceTop, borderRadius: 4 },
  barFillActive: { backgroundColor: Colors.accent },
  barDay: { color: Colors.textSec, fontSize: 10, marginTop: 6, fontWeight: '600' },
  barDayActive: { color: Colors.accent },

  sectionTitle: { color: Colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  tripCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripLeft: { flex: 1 },
  tripTime: { color: Colors.textSec, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  tripRoute: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  tripFrom: { color: Colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  tripArrow: { color: Colors.textMut, fontSize: 12 },
  tripTo: { color: Colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  tripMeta: { color: Colors.textSec, fontSize: 11 },
  tripRight: { alignItems: 'flex-end', marginLeft: 12 },
  tripFare: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  tripRating: { color: Colors.warning, fontSize: 11, marginTop: 2 },
});
