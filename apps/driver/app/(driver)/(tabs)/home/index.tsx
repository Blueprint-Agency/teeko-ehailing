import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert, Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import * as Location from 'expo-location';
import MapBackground from '../../../../components/driver/MapBackground';
import OnlineToggle from '../../../../components/driver/OnlineToggle';
import { useColors } from '../../../../constants/colors';
import { useTheme } from '../../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { api, resolveMediaUrl, type DriverProfile } from '../../../../lib/api';
import { getSocket } from '../../../../lib/socket';
import { useDriverStore } from '../../../../store/useDriverStore';

// Mock surge for v0.1 — replace with the live surge feed when it exists.
const SURGE = { multiplier: 1.4, area: 'Bukit Bintang' };

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const { isOnline, onlineSince, radius, setOnline, setRadius, activeTripId, pendingOffer, setActiveTripId, setActiveTrip, setActiveTripStatus } = useDriverStore();
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  // Last known fix + a heartbeat timer. watchPositionAsync only fires when the
  // device moves (distanceInterval), so a parked online driver would stop
  // emitting and let the server's 30s presence TTL expire — making the car
  // vanish from the rider map. The heartbeat re-pushes the last fix on a timer
  // to keep that TTL alive while online.
  const lastFix = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  // Today's totals for the header stats. Null until the first fetch lands, and
  // left null on failure — the tiles show a dash rather than a wrong number.
  const [today, setToday] = useState<{ netCents: number; tripCount: number } | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  // Guards the toggle while go-online/go-offline is in flight — the request can
  // take a second (permissions + first GPS fix) and a double tap would otherwise
  // fire two conflicting calls.
  const [togglePending, setTogglePending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api.earnings
        .get()
        .then((res) => { if (!cancelled) setToday(res.today); })
        .catch(() => { if (!cancelled) setToday(null); });
      api.profile
        .get()
        .then((res) => { if (!cancelled) setProfile(res.profile); })
        .catch(() => { if (!cancelled) setProfile(null); });
      return () => { cancelled = true; };
    }, []),
  );

  const handleResumeTrip = () => {
    router.replace('/(driver)/trip');
  };

  const handleCancelActiveTrip = () => {
    if (!activeTripId) return;
    Alert.alert('Cancel trip', 'Are you sure you want to cancel this trip?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          await api.driver.cancelTrip(activeTripId, 'driver_cancelled').catch(() => null);
          setActiveTripId(null);
          setActiveTrip(null);
          setActiveTripStatus(null);
        },
      },
    ]);
  };

  // trip.request is handled by SocketBridge in _layout.tsx

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    // Push the last known fix to the server (HTTP + socket). Also records it so
    // the heartbeat can re-send it while the driver is stationary.
    const pushLocation = (lat: number, lng: number, hdg: number) => {
      lastFix.current = { lat, lng, heading: hdg };
      api.driver.updateLocation(lat, lng, hdg).catch(() => null);
      getSocket().emit('driver.location', { lat, lng, heading: hdg });
    };

    // Push current position immediately so dispatch can find this driver right away
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude, heading } = current.coords;
    if (latitude !== 0 || longitude !== 0) {
      pushLocation(latitude, longitude, heading ?? 0);
    }

    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      (loc) => {
        const { latitude: lat, longitude: lng, heading: hdg } = loc.coords;
        if (lat === 0 && lng === 0) return;
        pushLocation(lat, lng, hdg ?? 0);
      },
    );

    // Heartbeat: re-emit the last fix every 10s so the server's 30s presence TTL
    // never lapses while the driver is online but not moving. No-op until the
    // first real fix lands.
    heartbeat.current = setInterval(() => {
      const f = lastFix.current;
      if (f) pushLocation(f.lat, f.lng, f.heading);
    }, 10_000);
  };

  const stopLocationTracking = () => {
    locationSub.current?.remove();
    locationSub.current = null;
    if (heartbeat.current) {
      clearInterval(heartbeat.current);
      heartbeat.current = null;
    }
    lastFix.current = null;
  };

  // Stop the GPS watch + heartbeat if this screen unmounts while still online,
  // so the interval/subscription don't leak. Refs only — safe to run once.
  useEffect(() => stopLocationTracking, []);

  const goOfflineNow = async () => {
    try {
      await api.driver.goOffline();
    } catch { /* ignore network errors — still go offline locally */ }
    stopLocationTracking();
    setOnline(false);
  };

  const handleToggleOnline = async () => {
    if (togglePending) return;
    // Confirm only when going offline would strand real work — an active trip or
    // a live offer on screen. Routine shift-end stays a single tap.
    if (isOnline && (activeTripId || pendingOffer)) {
      Alert.alert(
        'Go offline?',
        activeTripId
          ? 'You still have an active trip. Finish or cancel it before going offline.'
          : 'You have a trip request waiting. Going offline will decline it.',
        activeTripId
          ? [{ text: 'OK' }]
          : [
              { text: 'Stay online', style: 'cancel' },
              {
                text: 'Go offline',
                style: 'destructive',
                onPress: async () => {
                  setTogglePending(true);
                  await goOfflineNow();
                  setTogglePending(false);
                },
              },
            ],
      );
      return;
    }
    setTogglePending(true);
    if (isOnline) {
      await goOfflineNow();
    } else {
      try {
        await api.driver.goOnline();
        await startLocationTracking();
        setOnline(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not go online';
        Alert.alert('Error', msg);
      }
    }
    setTogglePending(false);
  };

  const handleSetRadius = async (r: number) => {
    setRadius(r);
    api.driver.setRadius(r).catch(() => null);
  };

  const avatarSrc = resolveMediaUrl(profile?.avatarUrl);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Top HUD */}
      <View style={[styles.hud, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/(driver)/(tabs)/profile')}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceHigh, borderColor: colors.accent }]}>
            {avatarSrc ? (
              <Image source={{ uri: avatarSrc }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.accent }]}>
                {profile?.fullName?.trim().charAt(0) ?? '·'}
              </Text>
            )}
          </View>
          <View style={[styles.onlineDot, { borderColor: colors.bg }, isOnline ? { backgroundColor: colors.online } : { backgroundColor: colors.textMut }]} />
        </TouchableOpacity>

        <View style={styles.hudCenter}>
          <Text style={[styles.hudLabel, { color: colors.text }]}>{isOnline ? t('driver.online') : t('driver.offline')}</Text>
          <Text style={[styles.hudSub, { color: colors.textSec }]}>{t('driver.radius', { r: radius })}</Text>
        </View>

        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(driver)/notifications')}>
          <Bell size={22} color={colors.text} strokeWidth={1.75} />
          <View style={[styles.notifBadge, { backgroundColor: colors.danger }]}>
            <Text style={styles.notifBadgeText}>2</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapBackground radius={radius}>
        {/* Surge pill */}
        <View style={styles.surgePill}>
          <View style={[styles.surgeDot, { backgroundColor: colors.surge }]} />
          <Text style={[styles.surgeText, { color: colors.surge }]}>
            {SURGE.multiplier.toFixed(1)}× surge · {SURGE.area}
          </Text>
        </View>
      </MapBackground>

      {/* Active trip banner — shown whenever the driver has an active trip on this screen,
          whether the app crashed (store restored from API) or they navigated back mid-trip */}
      {activeTripId ? (
        <View style={[styles.recoveryBanner, { backgroundColor: colors.accent + '18', borderColor: colors.accent }]}>
          <Text style={[styles.recoveryTitle, { color: colors.text }]}>You have an active trip</Text>
          <Text style={[styles.recoverySub, { color: colors.textSec }]}>Resume your trip or cancel it below.</Text>
          <View style={styles.recoveryBtns}>
            <TouchableOpacity
              style={[styles.recoveryBtn, { backgroundColor: colors.accent }]}
              onPress={handleResumeTrip}
            >
              <Text style={styles.recoveryBtnText}>Resume trip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.recoveryBtn, { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.danger }]}
              onPress={handleCancelActiveTrip}
            >
              <Text style={[styles.recoveryBtnText, { color: colors.danger }]}>Cancel trip</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Bottom Panel */}
      {/* Ambient state cue: the panel edge lights up green while online. Colour
          only — the border width is fixed, since changing it would resize the
          map by a pixel on every toggle. */}
      <View
        style={[
          styles.bottomPanel,
          {
            backgroundColor: colors.surface,
            borderTopColor: isOnline ? colors.online : colors.border,
          },
        ]}
      >
        {/* Today stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {today ? `RM ${(today.netCents / 100).toFixed(2)}` : 'RM —'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSec }]}>{t('driver.today')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>{today?.tripCount ?? '—'}</Text>
            <Text style={[styles.statLabel, { color: colors.textSec }]}>{t('driver.trips')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {profile?.rating != null ? profile.rating.toFixed(2) : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSec }]}>{t('driver.rating')}</Text>
          </View>
        </View>

        {/* Online toggle */}
        <OnlineToggle
          isOnline={isOnline}
          pending={togglePending}
          onToggle={handleToggleOnline}
          onlineSince={onlineSince}
        />

        {/* Radius selector */}
        <View style={styles.radiusRow}>
          <Text style={[styles.radiusLabel, { color: colors.textSec }]}>{t('driver.operatingRadius')}</Text>
          <View style={styles.radiusBtns}>
            {[3, 5, 10, 15].map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.radiusChip,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  radius === r && { backgroundColor: colors.accent + '20', borderColor: colors.accent },
                ]}
                onPress={() => handleSetRadius(r)}
              >
                <Text style={[styles.radiusChipText, { color: radius === r ? colors.accent : colors.textSec }]}>
                  {r}km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  avatarBtn: { position: 'relative' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontWeight: '800', fontSize: 16 },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  hudCenter: { flex: 1, alignItems: 'center' },
  hudLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  hudSub: { fontSize: 11, marginTop: 1 },
  notifBtn: { position: 'relative', width: 40, alignItems: 'flex-end' },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  surgePill: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    left: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,43,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,43,0.5)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  surgeDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  surgeText: { fontSize: 12, fontWeight: '700' },

  recoveryBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  recoveryTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  recoverySub: { fontSize: 12, marginBottom: 12 },
  recoveryBtns: { flexDirection: 'row', gap: 10 },
  recoveryBtn: {
    flex: 1, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  recoveryBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },

  bottomPanel: {
    borderTopWidth: 2,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, marginTop: 2, fontWeight: '600', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 36 },

  radiusRow: { marginTop: 4 },
  radiusLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 12,
    textTransform: 'uppercase'
  },
  radiusBtns: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 64,
    alignItems: 'center',
  },
  radiusChipText: { fontSize: 13, fontWeight: '700' },
});
