import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapBackground from '../../components/driver/MapBackground';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import request from '../../data/mock-ride-request.json';

export default function RideRequestScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const styles = createStyles(colors);
  const [remaining, setRemaining] = useState(request.countdownSeconds);

  useEffect(() => {
    if (remaining <= 0) { router.back(); return; }
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const progress = remaining / request.countdownSeconds;
  const circumference = 2 * Math.PI * 30;
  const strokeDash = circumference * progress;
  const urgent = remaining <= 7;

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Dimmed map behind */}
      <View style={styles.mapWrapper}>
        <MapBackground />
        <View style={styles.mapDim} />
      </View>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Countdown ring + header */}
        <View style={styles.topRow}>
          <View style={styles.ringWrapper}>
            <View style={[styles.ringTrack, urgent && styles.ringTrackUrgent]}>
              <Text style={[styles.ringNumber, urgent && styles.ringNumberUrgent]}>{remaining}</Text>
              <Text style={styles.ringS}>s</Text>
            </View>
          </View>

          <View style={styles.rideInfo}>
            <Text style={styles.rideType}>{request.rideType}</Text>
            <View style={styles.fareRow}>
              <Text style={styles.fare}>RM {request.fare.toFixed(2)}</Text>
              <Text style={styles.dist}>{request.destination.distance} km</Text>
            </View>
            <View style={styles.riderRow}>
              <Text style={styles.riderName}>{request.riderName}</Text>
              <Text style={styles.riderStar}>★ {request.riderRating}</Text>
              <Text style={styles.riderTrips}>· {request.riderTrips} trips</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Route */}
        <View style={styles.routeBlock}>
          <View style={styles.routeRow}>
            <View style={styles.dotPickup} />
            <View style={styles.routeTexts}>
              <Text style={styles.routeLabel}>PICKUP · {request.pickup.eta} min away</Text>
              <Text style={styles.routePlace}>{request.pickup.label}</Text>
            </View>
            <Text style={styles.routeDist}>{request.pickup.distance} km</Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeRow}>
            <View style={styles.dotDrop} />
            <View style={styles.routeTexts}>
              <Text style={styles.routeLabel}>DROP-OFF</Text>
              <Text style={styles.routePlace}>{request.destination.label}</Text>
            </View>
            <Text style={styles.routeDist}>{request.destination.distance} km</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => router.replace('/(driver)/trip')}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptText}>Accept Ride</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapWrapper: { flex: 1, position: 'relative' },
  mapDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,14,0.5)' },

  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 20,
  },

  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  ringWrapper: { marginRight: 20 },
  ringTrack: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent + '10',
  },
  ringTrackUrgent: { borderColor: colors.danger, backgroundColor: colors.danger + '14' },
  ringNumber: { color: colors.accent, fontSize: 24, fontWeight: '800' },
  ringNumberUrgent: { color: colors.danger },
  ringS: { color: colors.textSec, fontSize: 11, marginTop: -4 },

  rideInfo: { flex: 1 },
  rideType: { color: colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  fareRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  fare: { color: colors.text, fontSize: 28, fontWeight: '800' },
  dist: { color: colors.textSec, fontSize: 14, fontWeight: '600' },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  riderName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  riderStar: { color: colors.warning, fontSize: 13 },
  riderTrips: { color: colors.textSec, fontSize: 12 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16, marginHorizontal: 20 },

  routeBlock: { paddingHorizontal: 20 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dotPickup: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.accent, marginTop: 3,
  },
  dotDrop: {
    width: 12, height: 12, borderRadius: 3,
    backgroundColor: colors.danger, marginTop: 3,
  },
  routeTexts: { flex: 1 },
  routeLabel: { color: colors.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 },
  routePlace: { color: colors.text, fontSize: 14, fontWeight: '600' },
  routeLine: { width: 1, height: 16, backgroundColor: colors.border, marginLeft: 6, marginVertical: 4 },
  routeDist: { color: colors.textSec, fontSize: 12, marginTop: 3 },

  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 4 },
  declineBtn: {
    flex: 1, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1, borderColor: colors.border,
  },
  declineText: { color: colors.textSec, fontSize: 16, fontWeight: '700' },
  acceptBtn: {
    flex: 2, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  acceptText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
