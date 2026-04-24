import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import DocumentSlot from '../../../components/driver/DocumentSlot';
import { useColors } from '../../../constants/colors';
import { useTheme } from '../../../components/ThemeProvider';

export default function VehicleDocsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title="Vehicle Documents" onBack={() => router.back()} />

      <View style={styles.stepBar}>
        <View style={styles.stepDone} /><View style={styles.stepDone} /><View style={styles.stepDone} />
      </View>
      <Text style={styles.stepLabel}>Step 3 of 3 — Vehicle Documents</Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Upload documents for the vehicle you intend to register. Each vehicle requires its own set of documents.
        </Text>

        <DocumentSlot
          label="Car Grant / VOC"
          required
          hint="Vehicle Ownership Certificate (VOC) or car grant from JPJ."
        />
        <DocumentSlot
          label="Road Tax"
          required
          hint="Current road tax must be valid for at least 3 months."
        />
        <DocumentSlot
          label="e-Hailing Insurance Cover Note"
          required
          hint="Insurance policy with e-hailing endorsement. Must cover all passengers per trip."
        />
        <DocumentSlot
          label="PUSPAKOM Inspection Certificate"
          required
          hint="Annual vehicle inspection certificate from PUSPAKOM. Must not be expired."
        />
        <DocumentSlot
          label="Vehicle Photo (Front ¾)"
          required
          hint="Clear photo showing the vehicle plate, make, and colour."
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={() => router.replace('/(driver)/onboarding/pending')}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>Submit for Review</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          Our team reviews applications within 1–3 business days.
        </Text>
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
