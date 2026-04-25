import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import { useColors } from '../../../constants/colors';
import { useTheme } from '../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';

const TC_SECTIONS = [
  {
    title: '1. Driver-Partner Agreement',
    body: 'This Driver-Partner Agreement ("Agreement") is entered into between Teeko Technologies Sdn. Bhd. (Company No. xxxxxxx-X) ("Teeko") and you, the individual registering as a driver-partner ("Driver-Partner"). By accepting this Agreement, you acknowledge that you have read, understood, and agree to be bound by its terms.',
  },
  {
    title: '2. Eligibility Requirements',
    body: 'To operate on the Teeko platform, you must: (a) hold a valid Malaysian driving licence (CDL) and a valid PSV-D (Public Service Vehicle – Domestic) licence issued by APAD; (b) hold a valid e-hailing vehicle permit; (c) maintain valid road tax and e-hailing passenger insurance on your registered vehicle; (d) pass a PUSPAKOM vehicle inspection annually; and (e) be at least 21 years of age.',
  },
  {
    title: '3. Independent Contractor Status',
    body: 'You are an independent contractor and not an employee, agent, partner, or joint-venture partner of Teeko. Teeko does not control the manner or means by which you perform ride services. You are solely responsible for all taxes, insurance, and regulatory compliance arising from your operation.',
  },
  {
    title: '4. Compliance with APAD / JPJ Regulations',
    body: 'You must comply with all applicable Malaysian laws and regulations, including but not limited to the Land Public Transport Act 2010, the Commercial Vehicles Licensing Board Act 1987 (as amended), and all APAD/JPJ guidelines applicable to e-hailing operators and driver-partners.',
  },
  {
    title: '5. Personal Data Protection',
    body: 'Teeko collects, processes, and stores your personal data in accordance with the Personal Data Protection Act 2010 (PDPA). Your data is used to operate the platform, process payments, and fulfil regulatory obligations. You consent to the sharing of necessary data with APAD, JPJ, and insurance partners as required by law.',
  },
  {
    title: '6. Insurance',
    body: 'Teeko provides per-trip passenger accident insurance coverage as required by APAD. This coverage applies only during accepted trips on the Teeko platform. You remain responsible for maintaining your own comprehensive vehicle insurance with an e-hailing endorsement for all other periods.',
  },
  {
    title: '7. Service Standards',
    body: 'You agree to maintain a minimum rating of 4.0 stars. Failure to maintain this minimum may result in temporary suspension pending a review. Repeated violations of Teeko\'s community guidelines may result in permanent deactivation.',
  },
  {
    title: '8. Termination',
    body: 'Either party may terminate this Agreement at any time. Teeko reserves the right to deactivate your account immediately for serious violations including but not limited to fraud, criminal behaviour, or breach of safety standards.',
  },
];

export default function AgreementScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (isBottom) setScrolledToBottom(true);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.agreementTitle')} onBack={() => router.back()} />

      <View style={styles.stepBar}>
        <View style={styles.stepDone} /><View style={styles.stepActive} /><View style={styles.stepTodo} />
      </View>
      <Text style={styles.stepLabel}>{t('driver.step1Label')}</Text>

      <ScrollView
        contentContainerStyle={styles.scroll}
        onScroll={handleScroll}
        scrollEventThrottle={100}
      >
        <Text style={styles.preamble}>{t('driver.agreementPreamble')}</Text>

        {TC_SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={styles.bottomMarker}>
          <Text style={styles.bottomMarkerText}>{t('driver.endOfAgreement')}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!scrolledToBottom && (
          <Text style={styles.scrollHint}>{t('driver.scrollToAccept')}</Text>
        )}
        <TouchableOpacity
          style={[styles.acceptBtn, !scrolledToBottom && styles.acceptBtnDisabled]}
          onPress={() => scrolledToBottom && router.push('/(driver)/onboarding/personal-docs')}
          activeOpacity={scrolledToBottom ? 0.85 : 1}
        >
          <Text style={[styles.acceptText, !scrolledToBottom && styles.acceptTextDisabled]}>
            {t('driver.acceptAndContinue')}
          </Text>
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
  stepTodo: { flex: 1, backgroundColor: colors.border },
  stepLabel: {
    color: colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textAlign: 'center', paddingVertical: 8, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },

  scroll: { padding: 20, paddingBottom: 20 },
  preamble: {
    color: colors.textSec, fontSize: 13, lineHeight: 20, marginBottom: 24, padding: 14,
    backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  section: { marginBottom: 24 },
  sectionTitle: { color: colors.accent, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  sectionBody: { color: colors.text, fontSize: 13, lineHeight: 22 },
  bottomMarker: { alignItems: 'center', paddingVertical: 24 },
  bottomMarkerText: { color: colors.textMut, fontSize: 12 },

  footer: {
    padding: 20, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  scrollHint: { color: colors.textSec, fontSize: 12, textAlign: 'center', marginBottom: 10 },
  acceptBtn: { height: 56, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  acceptBtnDisabled: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  acceptText: { color: '#000', fontSize: 16, fontWeight: '800' },
  acceptTextDisabled: { color: colors.textMut },
});
