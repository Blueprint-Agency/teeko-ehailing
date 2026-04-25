import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import DocumentSlot from '../../../components/driver/DocumentSlot';
import { useColors } from '../../../constants/colors';
import { useTheme } from '../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';

export default function VehicleDocsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.vehicleDocsTitle')} onBack={() => router.back()} />

      <View style={styles.stepBar}>
        <View style={styles.stepDone} /><View style={styles.stepDone} /><View style={styles.stepDone} />
      </View>
      <Text style={styles.stepLabel}>{t('driver.step3Label')}</Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>{t('driver.vehicleDocsIntro')}</Text>

        <DocumentSlot label={t('driver.docCarGrant')} required hint={t('driver.docCarGrantHint')} />
        <DocumentSlot label={t('driver.docRoadTax')} required hint={t('driver.docRoadTaxHint')} />
        <DocumentSlot label={t('driver.docInsuranceFull')} required hint={t('driver.docInsuranceHint')} />
        <DocumentSlot label={t('driver.docPuspakomFull')} required hint={t('driver.docPuspakomHint')} />
        <DocumentSlot label={t('driver.docVehiclePhoto')} required hint={t('driver.docVehiclePhotoHint')} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={() => router.replace('/(driver)/onboarding/pending')}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>{t('driver.submitForReview')}</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>{t('driver.reviewNote')}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  stepBar: { flexDirection: 'row', height: 4, backgroundColor: colors.border },
  stepDone: { flex: 1, backgroundColor: colors.success },
  stepLabel: {
    color: colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textAlign: 'center', paddingVertical: 8,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  scroll: { padding: 20, paddingBottom: 20 },
  intro: {
    color: colors.textSec, fontSize: 13, lineHeight: 20, marginBottom: 24,
    padding: 14, backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  submitBtn: { height: 56, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  submitText: { color: '#000', fontSize: 16, fontWeight: '800' },
  footerNote: { color: colors.textSec, fontSize: 12, textAlign: 'center' },
});
