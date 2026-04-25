import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapBackground from '../../../../components/driver/MapBackground';
import { useColors } from '../../../../constants/colors';
import { useTheme } from '../../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import earnings from '../../../../data/mock-earnings.json';
import profile from '../../../../data/mock-driver-profile.json';

export default function HomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [radius, setRadius] = useState(5);
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Top HUD */}
      <View style={[styles.hud, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/(driver)/(tabs)/profile')}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceHigh, borderColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.accent }]}>{profile.name.charAt(0)}</Text>
          </View>
          <View style={[styles.onlineDot, { borderColor: colors.bg }, isOnline ? { backgroundColor: colors.online } : { backgroundColor: colors.textMut }]} />
        </TouchableOpacity>

        <View style={styles.hudCenter}>
          <Text style={[styles.hudLabel, { color: colors.text }]}>{isOnline ? t('driver.online') : t('driver.offline')}</Text>
          <Text style={[styles.hudSub, { color: colors.textSec }]}>{t('driver.radius', { r: radius })}</Text>
        </View>

        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(driver)/notifications')}>
          <Text style={styles.notifIcon}>🔔</Text>
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
          <Text style={[styles.surgeText, { color: colors.surge }]}>1.4× surge · Bukit Bintang</Text>
        </View>
      </MapBackground>

      {/* Bottom Panel */}
      <View style={[styles.bottomPanel, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {/* Today stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>RM {earnings.todayTotal.toFixed(2)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSec }]}>{t('driver.today')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>{earnings.todayTrips}</Text>
            <Text style={[styles.statLabel, { color: colors.textSec }]}>{t('driver.trips')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>{profile.rating}</Text>
            <Text style={[styles.statLabel, { color: colors.textSec }]}>{t('driver.rating')}</Text>
          </View>
        </View>

        {/* Online toggle */}
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            isOnline
              ? { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border }
              : { backgroundColor: colors.accent },
          ]}
          onPress={() => {
            if (!isOnline) router.push('/(driver)/request');
            else setIsOnline(false);
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.toggleBtnText, isOnline && { color: colors.textSec }]}>
            {isOnline ? t('driver.goOffline') : t('driver.goOnline')}
          </Text>
        </TouchableOpacity>

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
                onPress={() => setRadius(r)}
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
  },
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
  notifIcon: { fontSize: 22 },
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

  bottomPanel: {
    borderTopWidth: 1,
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

  toggleBtn: {
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  toggleBtnText: { color: '#000', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },

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
