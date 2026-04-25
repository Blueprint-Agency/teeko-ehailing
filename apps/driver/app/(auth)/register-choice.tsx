import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { useT } from '@teeko/i18n';

export default function RegisterChoiceScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('driver.joinTeeko')}</Text>
        <Text style={styles.subtitle}>{t('driver.howToUse')}</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(driver)/onboarding/agreement')}
          activeOpacity={0.85}
        >
          <View style={styles.cardIcon}><Text style={styles.cardIconText}>🚗</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{t('driver.signUpAsDriver')}</Text>
            <Text style={styles.cardDesc}>{t('driver.driverCardDesc')}</Text>
          </View>
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>RM 500+/week</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>{t('driver.driverDisclaimer')}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 24 },
  backBtn: { marginBottom: 32 },
  backText: { color: colors.accent, fontSize: 16 },

  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: colors.textSec, fontSize: 15, marginBottom: 28 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18, padding: 20,
    borderWidth: 1.5, borderColor: colors.accent,
    marginBottom: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  cardIcon: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: colors.accent + '1F',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  cardIconText: { fontSize: 28 },
  cardContent: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  cardDesc: { color: colors.textSec, fontSize: 13, lineHeight: 18 },
  cardBadge: {
    backgroundColor: colors.accent + '1F',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.accent,
  },
  cardBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '800' },

  disclaimer: { color: colors.textMut, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
