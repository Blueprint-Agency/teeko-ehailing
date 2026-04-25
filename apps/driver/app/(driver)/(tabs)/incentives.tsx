import React from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import { useColors } from '../../../constants/colors';
import { useTheme } from '../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import incentives from '../../../data/mock-incentives.json';

export default function IncentivesScreen() {
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.incentivesTitle')} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>{t('driver.incentivesIntro')}</Text>

        {incentives.map((inc) => {
          const pct = Math.min(inc.completedTrips / inc.targetTrips, 1);
          const done = (inc as any).completed || pct >= 1;
          const end = new Date(inc.endsAt);
          const hoursLeft = Math.max(0, Math.floor((end.getTime() - Date.now()) / 3600000));

          return (
            <View key={inc.id} style={[styles.card, done && styles.cardDone]}>
              {done && (
                <View style={styles.doneBadge}>
                  <Text style={styles.doneBadgeText}>{t('driver.earned')}</Text>
                </View>
              )}

              <View style={styles.cardHeader}>
                <View style={[styles.badge, { backgroundColor: inc.badgeColor + '20', borderColor: inc.badgeColor }]}>
                  <Text style={[styles.badgeText, { color: inc.badgeColor }]}>
                    RM {inc.bonusAmount.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.titleBlock}>
                  <Text style={styles.cardTitle}>{inc.title}</Text>
                  {!done && <Text style={styles.cardTimer}>⏱ {t('driver.hoursRemaining', { h: hoursLeft })}</Text>}
                </View>
              </View>

              <Text style={styles.cardDesc}>{inc.description}</Text>

              <View style={styles.progressBlock}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: inc.badgeColor }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {t('driver.tripsProgress', { completed: inc.completedTrips, target: inc.targetTrips })}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  intro: { color: colors.textSec, fontSize: 13, marginBottom: 20, lineHeight: 20 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  cardDone: { borderColor: colors.success, opacity: 0.8 },
  doneBadge: {
    position: 'absolute',
    top: 0, right: 0,
    backgroundColor: colors.success,
    paddingHorizontal: 12, paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  doneBadgeText: { color: '#000', fontSize: 11, fontWeight: '800' },

  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  badge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    marginRight: 12,
  },
  badgeText: { fontWeight: '800', fontSize: 16 },
  titleBlock: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardTimer: { color: colors.textSec, fontSize: 12 },

  cardDesc: { color: colors.textSec, fontSize: 13, lineHeight: 18, marginBottom: 14 },

  progressBlock: {},
  progressTrack: {
    height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { color: colors.textSec, fontSize: 12, fontWeight: '600', textAlign: 'right' },
});
