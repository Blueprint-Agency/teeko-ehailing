import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing, ActivityIndicator,
} from 'react-native';
import { Power } from 'lucide-react-native';
import { useColors } from '../../constants/colors';
import { useTheme } from '../ThemeProvider';
import { useT } from '@teeko/i18n';

type Props = {
  isOnline: boolean;
  pending?: boolean;
  onToggle: () => void;
  /** Epoch ms this online session began; null while offline. */
  onlineSince?: number | null;
};

/** Clock style: "1:04:23" past the hour, "04:23" before it. */
function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * The single most important control on the driver home screen, so it is styled
 * to be impossible to miss in either state:
 *
 * - Offline: a large brand-red CTA with a slow breathing halo behind it.
 * - Online: an online-tinted status card with a live pulsing dot, so the earning
 *   state is ambient rather than something you have to read a 12px label for.
 *   Going offline is a separate, smaller chip inside the card — that asymmetry
 *   is deliberate: accidentally going offline costs the driver money.
 */
export default function OnlineToggle({
  isOnline, pending = false, onToggle, onlineSince = null,
}: Props) {
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();

  // The light-theme accent is a pale red — white on it fails contrast, so the
  // CTA label flips to near-black there. Dark theme keeps white on deep red.
  const ctaFg = activeTheme === 'dark' ? '#FFFFFF' : '#0A0A0E';

  // Ticks every second while online — the seconds digit doubles as a liveness
  // signal. The interval is torn down the moment the driver goes offline.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOnline || onlineSince == null) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isOnline, onlineSince]);

  const sessionLabel = onlineSince != null ? formatDuration(Date.now() - onlineSince) : null;

  // One driver for both animations: the offline halo and the online live dot.
  // Native driver only touches transform/opacity, so it stays off the JS thread.
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: isOnline ? 900 : 1600,
          easing: Easing.out(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: isOnline ? 900 : 1600,
          easing: Easing.in(Easing.ease), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); pulse.setValue(0); };
  }, [isOnline, pulse]);

  if (isOnline) {
    return (
      <View
        style={[
          styles.onlineCard,
          { backgroundColor: colors.online + '14', borderColor: colors.online },
        ]}
      >
        <View style={styles.liveWrap}>
          <Animated.View
            style={[
              styles.liveHalo,
              {
                backgroundColor: colors.online,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
              },
            ]}
          />
          <View style={[styles.liveDot, { backgroundColor: colors.online }]} />
        </View>

        <View style={styles.onlineTextWrap}>
          <View style={styles.onlineTitleRow}>
            <Text style={[styles.onlineTitle, { color: colors.text }]}>{t('driver.online')}</Text>
            {sessionLabel ? (
              <>
                <Text style={[styles.onlineTitle, { color: colors.textMut }]}>·</Text>
                <Text style={[styles.sessionText, { color: colors.online }]}>{sessionLabel}</Text>
              </>
            ) : null}
          </View>
          <Text style={[styles.onlineSub, { color: colors.textSec }]} numberOfLines={1}>
            {t('driver.onlineSub')}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.offBtn, { borderColor: colors.danger, backgroundColor: colors.surface }]}
          onPress={onToggle}
          disabled={pending}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('driver.goOffline')}
        >
          {pending
            ? <ActivityIndicator size="small" color={colors.danger} />
            : <Text style={[styles.offBtnText, { color: colors.danger }]}>{t('driver.goOffline')}</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.offlineWrap}>
      <View style={styles.btnWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              backgroundColor: colors.accent,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.06] }) }],
            },
          ]}
        />
        <TouchableOpacity
          style={[styles.goBtn, { backgroundColor: colors.accent }, pending && { opacity: 0.7 }]}
          onPress={onToggle}
          disabled={pending}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('driver.goOnline')}
        >
          {pending ? (
            <ActivityIndicator color={ctaFg} />
          ) : (
            <>
              <Power size={22} color={ctaFg} strokeWidth={2.75} />
              <Text style={[styles.goBtnText, { color: ctaFg }]}>{t('driver.goOnline')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <Text style={[styles.offlineHint, { color: colors.textSec }]}>{t('driver.offlineSub')}</Text>
    </View>
  );
}

/**
 * Both states are pinned to this exact height. The bottom panel sits in the
 * same flex column as the map, so any height change here would resize the map
 * on every toggle — which re-lays out react-native-maps and visibly jumps the
 * camera. Offline (68 button + 8 gap + hint line) and online (card) both land
 * on this number; change one and you must change the other.
 */
const BLOCK_HEIGHT = 92;

const styles = StyleSheet.create({
  offlineWrap: { height: BLOCK_HEIGHT, marginBottom: 16 },
  btnWrap: { position: 'relative' },
  halo: {
    position: 'absolute',
    top: -6, left: -6, right: -6,
    height: 80,
    borderRadius: 22,
  },
  goBtn: {
    height: 68,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  goBtnText: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  offlineHint: { fontSize: 11, textAlign: 'center', marginTop: 8 },

  onlineCard: {
    height: BLOCK_HEIGHT,
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  liveWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  liveHalo: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  onlineTextWrap: { flex: 1 },
  onlineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
  sessionText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  onlineSub: { fontSize: 11, marginTop: 2 },
  offBtn: {
    minWidth: 96,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  offBtnText: { fontSize: 13, fontWeight: '700' },
});
