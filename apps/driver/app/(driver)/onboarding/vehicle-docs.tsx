import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import DocumentSlot from '../../../components/driver/DocumentSlot';
import { Colors } from '../../../constants/colors';

export default function VehicleDocsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  stepBar: { flexDirection: 'row', height: 4, backgroundColor: Colors.border },
  stepDone: { flex: 1, backgroundColor: Colors.success },
  stepLabel: {
    color: Colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textAlign: 'center', paddingVertical: 8,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  scroll: { padding: 20, paddingBottom: 20 },
  intro: {
    color: Colors.textSec, fontSize: 13, lineHeight: 20, marginBottom: 24,
    padding: 14, backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  submitBtn: { height: 56, borderRadius: 14, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  submitText: { color: '#000', fontSize: 16, fontWeight: '800' },
  footerNote: { color: Colors.textSec, fontSize: 12, textAlign: 'center' },
});
