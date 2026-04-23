import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapBackground from '../../components/driver/MapBackground';
import { Colors } from '../../constants/colors';
import request from '../../data/mock-ride-request.json';

const PHASES = [
  { key: 'navigating', label: 'Navigating to Pickup' },
  { key: 'arrived', label: 'Arrived at Pickup' },
  { key: 'inprogress', label: 'Trip in Progress' },
  { key: 'completed', label: 'Trip Completed' },
];

export default function TripScreen() {
  const router = useRouter();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = PHASES[phaseIndex];
  const isCompleted = phaseIndex === 3;

  const advancePhase = () => {
    if (isCompleted) {
      router.replace('/(driver)/home');
    } else {
      setPhaseIndex((i) => Math.min(i + 1, 3));
    }
  };

  const phaseActionLabel = () => {
    if (phaseIndex === 0) return 'I\'ve Arrived';
    if (phaseIndex === 1) return 'Start Trip';
    if (phaseIndex === 2) return 'End Trip';
    return 'Back to Home';
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Phase stepper */}
      <View style={styles.stepper}>
        {PHASES.map((p, i) => (
          <View key={p.key} style={styles.stepItem}>
            <View style={[
              styles.stepDot,
              i < phaseIndex && styles.stepDotDone,
              i === phaseIndex && styles.stepDotActive,
            ]}>
              {i < phaseIndex && <Text style={styles.stepCheck}>✓</Text>}
              {i === phaseIndex && <View style={styles.stepActiveDot} />}
            </View>
            {i < PHASES.length - 1 && (
              <View style={[styles.stepLine, i < phaseIndex && styles.stepLineDone]} />
            )}
          </View>
        ))}
      </View>
      <Text style={styles.phaseLabel}>{phase.label}</Text>

      {/* Map */}
      <MapBackground />

      {/* Rider card */}
      <View style={styles.card}>
        <View style={styles.riderInfo}>
          <View style={styles.riderAvatar}>
            <Text style={styles.riderAvatarText}>N</Text>
          </View>
          <View style={styles.riderDetails}>
            <Text style={styles.riderName}>{request.riderName}</Text>
            <Text style={styles.riderMeta}>★ {request.riderRating} · {request.rideType}</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={() => Alert.alert('Call', 'Calling rider...')}>
            <Text style={styles.callIcon}>📞</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.dotPickup} />
            <Text style={styles.routeText} numberOfLines={1}>{request.pickup.label}</Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={styles.dotDrop} />
            <Text style={styles.routeText} numberOfLines={1}>{request.destination.label}</Text>
          </View>
        </View>

        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Est. Fare</Text>
          <Text style={styles.fareValue}>RM {request.fare.toFixed(2)}</Text>
        </View>

        {/* Navigation buttons */}
        {!isCompleted && (
          <View style={styles.navBtns}>
            <TouchableOpacity style={styles.navBtn} onPress={() => Alert.alert('Maps', 'Opening Google Maps...')}>
              <Text style={styles.navBtnText}>Open in Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => Alert.alert('Waze', 'Opening Waze...')}>
              <Text style={styles.navBtnText}>Open in Waze</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.sosBtn}
            onPress={() => Alert.alert('SOS', 'Emergency services will be contacted.')}
          >
            <Text style={styles.sosBtnText}>SOS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.phaseBtn, isCompleted && styles.phaseBtnDone]}
            onPress={advancePhase}
            activeOpacity={0.85}
          >
            <Text style={[styles.phaseBtnText, isCompleted && styles.phaseBtnTextDone]}>
              {phaseActionLabel()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: Colors.bg,
  },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  stepDotDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  stepDotActive: { borderColor: Colors.accent },
  stepActiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  stepCheck: { color: '#000', fontSize: 12, fontWeight: '800' },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: Colors.accent },
  phaseLabel: {
    color: Colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 0.8,
    textAlign: 'center', paddingBottom: 8, backgroundColor: Colors.bg,
  },

  card: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 20,
    paddingBottom: 28,
  },
  riderInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  riderAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 2, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  riderAvatarText: { color: Colors.accent, fontWeight: '800', fontSize: 18 },
  riderDetails: { flex: 1, marginLeft: 12 },
  riderName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  riderMeta: { color: Colors.textSec, fontSize: 13, marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  callIcon: { fontSize: 20 },

  routeCard: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotPickup: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  dotDrop: { width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.danger },
  routeText: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600' },
  routeConnector: { width: 1, height: 12, backgroundColor: Colors.border, marginLeft: 5, marginVertical: 4 },

  fareRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  fareLabel: { color: Colors.textSec, fontSize: 13 },
  fareValue: { color: Colors.text, fontSize: 20, fontWeight: '800' },

  navBtns: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  navBtn: {
    flex: 1, height: 40, borderRadius: 10,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnText: { color: Colors.text, fontSize: 13, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 12 },
  sosBtn: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: 'rgba(255,59,92,0.15)',
    borderWidth: 1.5, borderColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  sosBtnText: { color: Colors.danger, fontSize: 13, fontWeight: '800' },
  phaseBtn: {
    flex: 1, height: 56, borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  phaseBtnDone: { backgroundColor: Colors.success },
  phaseBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  phaseBtnTextDone: { color: '#000' },
});
