import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Car } from 'lucide-react-native';
import ScreenHeader from '../../../components/driver/ScreenHeader';
import { useColors } from '../../../constants/colors';
import { useTheme } from '../../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { api, type DriverVehicle } from '../../../lib/api';
import { openPortal } from '../../../lib/portal';

// A driver has exactly one registered vehicle. Changing car — like every other
// document-bearing change — happens in the web portal and is admin-reviewed.
export default function VehicleScreen() {
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  const [vehicle, setVehicle] = useState<DriverVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.vehicle.get();
      setVehicle(res.vehicle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your vehicle.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const DOC_LABELS: Record<string, string> = {
    car_grant: t('driver.docCarGrant'),
    road_tax: t('driver.docRoadTax'),
    insurance: t('driver.docInsurance'),
    puspakom: t('driver.docPuspakom'),
  };

  const STATUS_LABEL: Record<string, string> = {
    approved: t('driver.statusValid'),
    pending: t('driver.statusPending'),
    expiring_soon: t('driver.statusExpiringSoon'),
    expired: t('driver.statusExpired'),
    rejected: t('driver.statusExpired'),
    missing: t('driver.statusPending'),
  };

  const STATUS_COLOR: Record<string, string> = {
    approved: colors.success,
    pending: colors.warning,
    expiring_soon: colors.warning,
    expired: colors.danger,
    rejected: colors.danger,
    missing: colors.textMut,
  };

  const body = () => {
    if (loading) {
      return <View style={styles.centre}><ActivityIndicator color={colors.accent} /></View>;
    }
    if (error) {
      return (
        <View style={styles.centre}>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.secondaryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!vehicle) {
      return (
        <View style={styles.centre}>
          <Car size={32} color={colors.textMut} strokeWidth={1.5} />
          <Text style={styles.muted}>
            No vehicle registered yet. Add your vehicle and its documents in the driver portal.
          </Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => openPortal('/onboarding/vehicle-details')}
          >
            <Text style={styles.secondaryBtnText}>Open driver portal</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <View style={styles.vehicleHeader}>
          <View style={styles.vehicleIcon}>
            <Car size={26} color={colors.accent} strokeWidth={1.75} />
          </View>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleName}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
            <Text style={styles.vehiclePlate}>{vehicle.plateNumber}</Text>
            {!!vehicle.colour && <Text style={styles.vehicleColor}>{vehicle.colour}</Text>}
          </View>
        </View>

        <View style={styles.docDivider} />

        <Text style={styles.docsTitle}>{t('driver.vehicleDocs')}</Text>
        {vehicle.documents.map((doc) => (
          <View key={doc.kind} style={styles.docRow}>
            <Text style={styles.docLabel}>{DOC_LABELS[doc.kind] ?? doc.kind}</Text>
            <View style={styles.docRight}>
              {!!doc.expiry && <Text style={styles.docExpiry}>{doc.expiry}</Text>}
              <View style={[styles.docBadge, { backgroundColor: STATUS_COLOR[doc.status] + '20', borderColor: STATUS_COLOR[doc.status] }]}>
                <Text style={[styles.docBadgeText, { color: STATUS_COLOR[doc.status] }]}>
                  {STATUS_LABEL[doc.status] ?? doc.status}
                </Text>
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => openPortal('/profile')}>
          <Text style={styles.secondaryBtnText}>Update vehicle or documents</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.myVehicleTitle')} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.accent}
          />
        }
      >
        {body()}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40, flexGrow: 1 },

  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  muted: { color: colors.textSec, fontSize: 13, lineHeight: 20, textAlign: 'center' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },

  secondaryBtn: {
    marginTop: 16,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.text, fontSize: 14, fontWeight: '700' },

  vehicleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  vehicleIcon: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  vehicleIconText: {},
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
