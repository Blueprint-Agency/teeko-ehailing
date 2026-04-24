import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import { useColors } from '../../../constants/colors';
import { useTheme } from '../../../components/ThemeProvider';
import vehicles from '../../../data/mock-vehicles.json';

const DOC_LABELS: Record<string, string> = {
  carGrant: 'Car Grant / VOC',
  roadTax: 'Road Tax',
  insurance: 'e-Hailing Insurance',
  puspakom: 'PUSPAKOM',
};

const STATUS_LABEL: Record<string, string> = {
  approved: 'Valid',
  pending: 'Pending',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
};

export default function VehiclesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const styles = createStyles(colors);

  const STATUS_COLOR: Record<string, string> = {
    approved: colors.success,
    pending: colors.warning,
    expiring_soon: colors.warning,
    expired: colors.danger,
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader
        title="My Vehicles"
        right={
          <TouchableOpacity onPress={() => Alert.alert('Add Vehicle', 'Vehicle registration coming soon.')}>
            <Text style={styles.addBtn}>＋</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {vehicles.map((v) => (
          <View key={v.id} style={[styles.card, v.isActive && styles.cardActive]}>
            {v.isActive && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>Active Vehicle</Text>
              </View>
            )}

            <View style={styles.vehicleHeader}>
              <View style={styles.vehicleIcon}>
                <Text style={styles.vehicleIconText}>🚗</Text>
              </View>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleName}>{v.year} {v.make} {v.model}</Text>
                <Text style={styles.vehiclePlate}>{v.plate}</Text>
                <Text style={styles.vehicleColor}>{v.color}</Text>
              </View>
            </View>

            <View style={styles.docDivider} />

            <Text style={styles.docsTitle}>Documents</Text>
            {Object.entries(v.docs).map(([key, doc]) => (
              <View key={key} style={styles.docRow}>
                <Text style={styles.docLabel}>{DOC_LABELS[key]}</Text>
                <View style={styles.docRight}>
                  {doc.expiry && (
                    <Text style={styles.docExpiry}>{doc.expiry}</Text>
                  )}
                  <View style={[styles.docBadge, { backgroundColor: STATUS_COLOR[doc.status] + '20', borderColor: STATUS_COLOR[doc.status] }]}>
                    <Text style={[styles.docBadgeText, { color: STATUS_COLOR[doc.status] }]}>
                      {STATUS_LABEL[doc.status]}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  addBtn: { color: colors.accent, fontSize: 24, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    position: 'relative',
  },
  cardActive: { borderColor: colors.accent },
  activePill: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.accent,
    paddingHorizontal: 12, paddingVertical: 4,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 12,
  },
  activePillText: { color: '#000', fontSize: 11, fontWeight: '800' },

  vehicleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  vehicleIcon: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  vehicleIconText: { fontSize: 26 },
  vehicleInfo: {},
  vehicleName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  vehiclePlate: {
    color: colors.accent, fontSize: 18, fontWeight: '800',
    letterSpacing: 1, marginTop: 2,
  },
  vehicleColor: { color: colors.textSec, fontSize: 12, marginTop: 2 },

  docDivider: { height: 1, backgroundColor: colors.border, marginBottom: 14 },
  docsTitle: { color: colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },

  docRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  docLabel: { color: colors.text, fontSize: 13, fontWeight: '500', flex: 1 },
  docRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docExpiry: { color: colors.textSec, fontSize: 11 },
  docBadge: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  docBadgeText: { fontSize: 11, fontWeight: '700' },
});
