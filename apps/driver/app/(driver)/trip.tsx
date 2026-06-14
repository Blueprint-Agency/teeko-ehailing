import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, Check } from 'lucide-react-native';
import * as Location from 'expo-location';
import type { DirectionsResult, FetchDirectionsOptions } from '@teeko/shared';
import { formatDistance, formatDuration, useDirections } from '@teeko/maps';
import MapBackground from '../../components/driver/MapBackground';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { api } from '../../lib/api';
import { useDriverStore } from '../../store/useDriverStore';

const PHASE_KEYS = ['navigating', 'arrived', 'inprogress', 'completed'] as const;

export default function TripScreen() {
  const router = useRouter();
  const activeTripStatus = useDriverStore((s) => s.activeTripStatus);

  function statusToPhase(status: string | null): number {
    if (status === 'driver_arrived') return 1;
    if (status === 'in_trip') return 2;
    return 0;
  }

  const [phaseIndex, setPhaseIndex] = useState(() => statusToPhase(activeTripStatus));
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const { activeTripId, setActiveTripId, activeTrip, setActiveTrip } = useDriverStore();

  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      // Seed immediately so the first directions fetch doesn't wait for the watch
      Location.getLastKnownPositionAsync({}).then((pos) => {
        if (pos) setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }).catch(() => null);
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 15 },
        (loc) => setDriverLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
      ).then((s) => { sub = s; });
    });
    return () => { sub?.remove(); };
  }, []);

  // Always use live driver position as origin so "remaining route" is accurate.
  // Phase 0: driver → pickup. Phases 1 & 2: driver → destination.
  const directionsDestination =
    phaseIndex === 0
      ? (activeTrip?.pickup ?? null)
      : (activeTrip?.destination ?? null);

  const driverFetcher = (
    o: { lat: number; lng: number },
    d: { lat: number; lng: number },
    opts?: FetchDirectionsOptions,
  ): Promise<DirectionsResult> =>
    api.driver.directions(o, d, opts) as Promise<DirectionsResult>;

  const { result: directions } = useDirections({
    origin: driverLocation,
    destination: directionsDestination,
    fetcher: driverFetcher,
    options: { mode: 'driving', departureTime: 'now' },
    enabled: phaseIndex < 3 && !!driverLocation,
  });

  const PHASES = [
    { key: 'navigating', label: t('driver.navigatingToPickup') },
    { key: 'arrived', label: t('driver.arrivedAtPickup') },
    { key: 'inprogress', label: t('driver.tripInProgress') },
    { key: 'completed', label: t('driver.tripCompleted') },
  ];

  const phase = PHASES[phaseIndex];
  const isCompleted = phaseIndex === 3;

  const advancePhase = async () => {
    if (isCompleted) {
      setActiveTripId(null);
      setActiveTrip(null);
      router.replace('/(driver)/(tabs)/home');
      return;
    }
    try {
      if (activeTripId) {
        if (phaseIndex === 0) await api.driver.arrivedAtPickup(activeTripId);
        else if (phaseIndex === 1) await api.driver.startTrip(activeTripId);
        else if (phaseIndex === 2) await api.driver.completeTrip(activeTripId);
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
      return;
    }
    setPhaseIndex((i) => Math.min(i + 1, 3));
  };

  const handleSOS = async () => {
    Alert.alert('SOS', 'Emergency services will be contacted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm SOS',
        style: 'destructive',
        onPress: async () => {
          if (activeTripId) {
            await api.driver.cancelTrip(activeTripId, 'driver_sos').catch(() => null);
            setActiveTripId(null);
            setActiveTrip(null);
          }
          router.replace('/(driver)/(tabs)/home');
        },
      },
    ]);
  };

  // Phase 0 → navigate to pickup; phase 2 → navigate to destination
  const navDestination =
    phaseIndex === 0 ? activeTrip?.pickup : activeTrip?.destination;

  const openInMaps = () => {
    if (!navDestination) return;
    const { lat, lng } = navDestination;
    Linking.openURL(
      `https://maps.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    );
  };

  const openInWaze = () => {
    if (!navDestination) return;
    const { lat, lng } = navDestination;
    Linking.openURL(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
  };

  const phaseActionLabel = () => {
    if (phaseIndex === 0) return t('driver.iveArrived');
    if (phaseIndex === 1) return t('driver.startTrip');
    if (phaseIndex === 2) return t('driver.endTrip');
    return t('driver.backToHome');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Phase stepper */}
      <View style={styles.stepper}>
        {PHASES.map((p, i) => (
          <View key={p.key} style={styles.stepItem}>
            <View style={[
              styles.stepDot,
              i < phaseIndex && styles.stepDotDone,
              i === phaseIndex && styles.stepDotActive,
            ]}>
              {i < phaseIndex && <Check size={12} color="#000" strokeWidth={2.5} />}
              {i === phaseIndex && <View style={styles.stepActiveDot} />}
            </View>
            {i < PHASES.length - 1 && (
              <View style={[styles.stepLine, i < phaseIndex && styles.stepLineDone]} />
            )}
          </View>
        ))}
      </View>
      <Text style={styles.phaseLabel}>{phase.label}</Text>

      {/* Map */}
      <MapBackground
        routePolyline={directions?.polyline}
        liveLocation={driverLocation}
        followDriver={phaseIndex === 1 || phaseIndex === 3}
        pickupMarker={activeTrip?.pickup ? { lat: activeTrip.pickup.lat, lng: activeTrip.pickup.lng } : undefined}
        destinationMarker={activeTrip?.destination ? { lat: activeTrip.destination.lat, lng: activeTrip.destination.lng } : undefined}
      />

      {/* Rider card */}
      <View style={styles.card}>
        <View style={styles.riderInfo}>
          <View style={styles.riderAvatar}>
            <Text style={styles.riderAvatarText}>{activeTrip?.riderName?.[0] ?? '?'}</Text>
          </View>
          <View style={styles.riderDetails}>
            <Text style={styles.riderName}>{activeTrip?.riderName ?? '—'}</Text>
            <Text style={styles.riderMeta}>{activeTrip?.category?.toUpperCase() ?? '—'}</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={() => Alert.alert('Call', 'Calling rider...')}>
            <Phone size={18} color={colors.text} strokeWidth={1.75} />
          </TouchableOpacity>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.dotPickup} />
            <Text style={styles.routeText} numberOfLines={1}>{activeTrip?.pickup.address ?? '—'}</Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={styles.dotDrop} />
            <Text style={styles.routeText} numberOfLines={1}>{activeTrip?.destination.address ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.fareRow}>
          <View>
            <Text style={styles.fareLabel}>{t('driver.estFare')}</Text>
            {directions ? (
              <Text style={[styles.fareLabel, { marginTop: 2 }]}>
                {formatDistance(directions.distanceMeters)} ·{' '}
                {formatDuration(directions.durationInTrafficSeconds ?? directions.durationSeconds)}
              </Text>
            ) : null}
          </View>
          <Text style={styles.fareValue}>RM {activeTrip ? (activeTrip.fareCents / 100).toFixed(2) : '—'}</Text>
        </View>

        {/* Navigation buttons */}
        {!isCompleted && (
          <View style={styles.navBtns}>
            <TouchableOpacity style={styles.navBtn} onPress={openInMaps}>
              <Text style={styles.navBtnText}>{t('driver.openInMaps')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={openInWaze}>
              <Text style={styles.navBtnText}>{t('driver.openInWaze')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.sosBtn}
            onPress={handleSOS}
          >
            <Text style={styles.sosBtnText}>SOS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.phaseBtn, isCompleted && styles.phaseBtnDone]}
            onPress={advancePhase}
            activeOpacity={0.85}
          >
            <Text style={[styles.phaseBtnText, isCompleted && styles.phaseBtnTextDone]}>
              {phaseActionLabel()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: colors.bg,
  },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepDotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepDotActive: { borderColor: colors.accent },
  stepActiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  stepCheck: {},
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: colors.accent },
  phaseLabel: {
    color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 0.8,
    textAlign: 'center', paddingBottom: 8, backgroundColor: colors.bg,
  },

  card: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 20,
    paddingBottom: 28,
  },
  riderInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  riderAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  riderAvatarText: { color: colors.accent, fontWeight: '800', fontSize: 18 },
  riderDetails: { flex: 1, marginLeft: 12 },
  riderName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  riderMeta: { color: colors.textSec, fontSize: 13, marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  callIcon: {},

  routeCard: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotPickup: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  dotDrop: { width: 10, height: 10, borderRadius: 2, backgroundColor: colors.danger },
  routeText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  routeConnector: { width: 1, height: 12, backgroundColor: colors.border, marginLeft: 5, marginVertical: 4 },

  fareRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  fareLabel: { color: colors.textSec, fontSize: 13 },
  fareValue: { color: colors.text, fontSize: 20, fontWeight: '800' },

  navBtns: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  navBtn: {
    flex: 1, height: 40, borderRadius: 10,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 12 },
  sosBtn: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: colors.danger + '15',
    borderWidth: 1.5, borderColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  sosBtnText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  phaseBtn: {
    flex: 1, height: 56, borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  phaseBtnDone: { backgroundColor: colors.accent },
  phaseBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  phaseBtnTextDone: { color: '#000' },
});
