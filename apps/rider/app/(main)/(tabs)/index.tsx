import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { useLocationStore, usePlacesStore, useTripStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { MapView, type MapViewHandle, Marker } from '@teeko/maps';
import type { Place } from '@teeko/shared';
import { Icon, Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { CarMarker } from '../../../components/CarMarker';
import { RecentPlaceRow } from '../../../components/RecentPlaceRow';
import { WhereToBar } from '../../../components/WhereToBar';

const NEARBY_OFFSETS = [
  { id: 'n1', dLat: 0.0018, dLng: 0.0022, heading: 34, phase: 0.0 },
  { id: 'n2', dLat: -0.0014, dLng: 0.0031, heading: 118, phase: 1.1 },
  { id: 'n3', dLat: 0.0026, dLng: -0.0019, heading: 202, phase: 2.3 },
  { id: 'n4', dLat: -0.0024, dLng: -0.0027, heading: 280, phase: 3.7 },
  { id: 'n5', dLat: 0.0009, dLng: -0.0036, heading: 65, phase: 4.9 },
];
const NEARBY_DRIFT = 0.00025;
const DEFAULT_ZOOM = { latitudeDelta: 0.018, longitudeDelta: 0.018 };

export default function HomeTab() {
  const router = useRouter();
  const t = useT();
  const recent = usePlacesStore((s) => s.recent);
  const saved = usePlacesStore((s) => s.saved);
  const loadRecent = usePlacesStore((s) => s.loadRecent);
  const loadSaved = usePlacesStore((s) => s.loadSaved);
  const setDestination = useTripStore((s) => s.setDestination);
  const currentLatLng = useLocationStore((s) => s.current);
  const setCurrent = useLocationStore((s) => s.setCurrent);
  const setPermission = useLocationStore((s) => s.setPermission);

  const mapRef = useRef<MapViewHandle>(null);
  const snappedToUser = useRef(false);

  const [driftTick, setDriftTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setDriftTick((x) => x + 1), 600);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    loadRecent();
    loadSaved();
  }, [loadRecent, loadSaved]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermission(
          status === 'granted'
            ? 'granted'
            : status === 'denied'
              ? 'denied'
              : 'undetermined',
        );
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setCurrent({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (!snappedToUser.current) {
          mapRef.current?.animateToRegion(
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              ...DEFAULT_ZOOM,
            },
            400,
          );
          snappedToUser.current = true;
        }
      } catch {
        // ignore — fall back to default centre
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCurrent, setPermission]);

  const homePlace = saved.find((p) => p.category === 'home');
  const workPlace = saved.find((p) => p.category === 'work');

  const goToSearch = () => router.push('/(main)/search');

  const onShortcut = (place: Place | undefined, intent: 'saveHome' | 'saveWork') => {
    if (place) {
      setDestination(place);
      router.push('/(main)/confirm-destination');
    } else {
      router.push({ pathname: '/(main)/search', params: { intent } });
    }
  };

  const onRecent = (p: Place) => {
    setDestination(p);
    router.push('/(main)/confirm-destination');
  };

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: currentLatLng.lat,
            longitude: currentLatLng.lng,
            ...DEFAULT_ZOOM,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {NEARBY_OFFSETS.map((o) => {
            const drift = Math.sin(driftTick * 0.4 + o.phase) * NEARBY_DRIFT;
            return (
              <Marker
                key={o.id}
                coordinate={{
                  latitude: currentLatLng.lat + o.dLat + drift,
                  longitude: currentLatLng.lng + o.dLng + drift,
                }}
              >
                <CarMarker heading={o.heading} />
              </Marker>
            );
          })}
        </MapView>
      </View>

      <SafeAreaView edges={['bottom']} className="bg-surface">
        <ScrollView
          className="border-t border-border"
          contentContainerStyle={{ paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-gutter">
            <WhereToBar onPress={goToSearch} />
          </View>

          <View className="mt-3 flex-row gap-3 px-gutter">
            <Shortcut
              icon="home"
              label={homePlace?.address ? t('home.home') : t('home.setHome')}
              onPress={() => onShortcut(homePlace, 'saveHome')}
            />
            <Shortcut
              icon="work"
              label={workPlace?.address ? t('home.work') : t('home.setWork')}
              onPress={() => onShortcut(workPlace, 'saveWork')}
            />
          </View>

          {recent.length > 0 ? (
            <View className="mt-4">
              <Text
                weight="bold"
                className="px-gutter pb-2 text-xs uppercase tracking-wide text-ink-secondary"
              >
                {t('home.recent')}
              </Text>
              {recent.slice(0, 3).map((p) => (
                <RecentPlaceRow key={p.id} place={p} onPress={() => onRecent(p)} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: 'home' | 'work';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      className="h-12 flex-1 flex-row items-center rounded-full bg-muted px-4 active:opacity-80"
    >
      <Icon name={icon} size={18} color="#111111" />
      <Text weight="medium" className="ml-2 text-sm">
        {label}
      </Text>
    </Pressable>
  );
}
