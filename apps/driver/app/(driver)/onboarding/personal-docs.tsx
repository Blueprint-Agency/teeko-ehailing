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

export default function PersonalDocsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.personalDocsTitle')} onBack={() => router.back()} />

      <View style={styles.stepBar}>
        <View style={styles.stepDone} /><View style={styles.stepDone} /><View style={styles.stepActive} />
      </View>
      <Text style={styles.stepLabel}>{t('driver.step2Label')}</Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>{t('driver.personalDocsIntro')}</Text>

        <DocumentSlot label={t('driver.docMykadFront')} required hint={t('driver.docMykadFrontHint')} />
        <DocumentSlot label={t('driver.docMykadBack')} required hint={t('driver.docMykadBackHint')} />
        <DocumentSlot label={t('driver.docCdl')} required hint={t('driver.docCdlHint')} />
        <DocumentSlot label={t('driver.docPsvd')} required hint={t('driver.docPsvdHint')} />
        <DocumentSlot label={t('driver.docSelfie')} required hint={t('driver.docSelfieHint')} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => router.push('/(driver)/onboarding/vehicle-docs')}
          activeOpacity={0.85}
        >
          <Text style={styles.nextText}>{t('driver.continueToVehicleDocs')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  stepBar: { flexDirection: 'row', height: 4, backgroundColor: colors.border },
  stepDone: { flex: 1, backgroundColor: colors.success },
  stepActive: { flex: 1, backgroundColor: colors.accent },
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
  nextBtn: { height: 56, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  nextText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
