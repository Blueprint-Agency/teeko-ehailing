import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';

export default function RegisterChoiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Join Teeko</Text>
        <Text style={styles.subtitle}>How would you like to use Teeko?</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(driver)/onboarding/agreement')}
          activeOpacity={0.85}
        >
          <View style={styles.cardIcon}><Text style={styles.cardIconText}>🚗</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Sign up as a Driver</Text>
            <Text style={styles.cardDesc}>Earn money on your schedule. Drive when you want.</Text>
          </View>
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>RM 500+/week</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardRider]}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <View style={[styles.cardIcon, styles.cardIconRider]}><Text style={styles.cardIconText}>👤</Text></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Sign up as a Rider</Text>
            <Text style={styles.cardDesc}>Get affordable rides across Malaysia.</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Driver registration requires a valid CDL, PSV-D licence, and vehicle documents. Review takes 1–3 business days.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: 24 },
  backBtn: { marginBottom: 32 },
  backText: { color: Colors.accent, fontSize: 16 },

  title: { color: Colors.text, fontSize: 30, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: Colors.textSec, fontSize: 15, marginBottom: 28 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18, padding: 20,
    borderWidth: 1.5, borderColor: Colors.accent,
    marginBottom: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  cardRider: { borderColor: Colors.border },
  cardIcon: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: 'rgba(204,255,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  cardIconRider: { backgroundColor: Colors.surfaceHigh },
  cardIconText: { fontSize: 28 },
  cardContent: { flex: 1 },
  cardTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  cardDesc: { color: Colors.textSec, fontSize: 13, lineHeight: 18 },
  cardBadge: {
    backgroundColor: 'rgba(204,255,0,0.12)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.accent,
  },
  cardBadgeText: { color: Colors.accent, fontSize: 11, fontWeight: '800' },

  disclaimer: { color: Colors.textMut, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
