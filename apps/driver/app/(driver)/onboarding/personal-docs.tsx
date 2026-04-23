import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import DocumentSlot from '../../../components/driver/DocumentSlot';
import { Colors } from '../../../constants/colors';

export default function PersonalDocsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScreenHeader title="Personal Documents" onBack={() => router.back()} />

      <View style={styles.stepBar}>
        <View style={styles.stepDone} /><View style={styles.stepDone} /><View style={styles.stepActive} />
      </View>
      <Text style={styles.stepLabel}>Step 2 of 3 — Personal Documents</Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Upload clear, unobstructed photos of each document. All documents must be valid and legible. Blurry or expired documents will be rejected.
        </Text>

        <DocumentSlot
          label="MyKad / NRIC (Front)"
          required
          hint="Show the front face clearly. Ensure all text is readable."
        />
        <DocumentSlot
          label="MyKad / NRIC (Back)"
          required
          hint="Show the back face with the chip visible."
        />
        <DocumentSlot
          label="Driving Licence (CDL)"
          required
          hint="Must be valid and show your licence class."
        />
        <DocumentSlot
          label="PSV-D Licence"
          required
          hint="Public Service Vehicle (Domestic) licence issued by APAD."
        />
        <DocumentSlot
          label="Profile Selfie"
          required
          hint="Take a clear selfie facing the camera in good lighting. No hats or sunglasses."
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => router.push('/(driver)/onboarding/vehicle-docs')}
          activeOpacity={0.85}
        >
          <Text style={styles.nextText}>Continue to Vehicle Docs</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  stepBar: { flexDirection: 'row', height: 4, backgroundColor: Colors.border },
  stepDone: { flex: 1, backgroundColor: Colors.success },
  stepActive: { flex: 1, backgroundColor: Colors.accent },
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
  nextBtn: { height: 56, borderRadius: 14, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  nextText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
