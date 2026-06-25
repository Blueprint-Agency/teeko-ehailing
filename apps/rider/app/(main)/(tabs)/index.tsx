import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { driversApi, useLocationStore, usePlacesStore, useTripStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { MapView, type MapViewHandle, Marker } from '@teeko/maps';
import type { Place } from '@teeko/shared';
import { Icon, Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { CarMarker } from '../../../components/CarMarker';
import { RecentPlaceRow } from '../../../components/RecentPlaceRow';
import { WhereToBar } from '../../../components/WhereToBar';

const DEFAULT_ZOOM = { latitudeDelta: 0.018, longitudeDelta: 0.018 };
// How often to refresh the ambient "cars around you" dots, in ms.
const NEARBY_POLL_MS = 10_000;

export default function HomeTab() {
  const router = useRouter();
  const t = useT();
  const recent = usePlacesStore((s) => s.recent);
  const saved = usePlacesStore((s) => s.saved);
  const loadRecent = usePlacesStore((s) => s.loadRecent);
  const loadSaved = usePlacesStore((s) => s.loadSaved);
  const setDestination = useTripStore((s) => s.setDestination);
  const setCurrent = useLocationStore((s) => s.setCurrent);
  const setPermission = useLocationStore((s) => s.setPermission);
  const current = useLocationStore((s) => s.current);

  const mapRef = useRef<MapViewHandle>(null);
  const snappedToUser = useRef(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<driversApi.NearbyDriver[]>([]);

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

  // Poll for ambient online drivers around the rider's location so the home map
  // shows "cars nearby". Best-effort: failures (no Redis, no drivers online)
  // just leave the map empty. Re-runs when the location first resolves.
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const drivers = await driversApi.nearby(current);
        if (!cancelled) setNearbyDrivers(drivers);
      } catch {
        // ignore — ambient dots are non-critical
      }
    };
    tick();
    const id = setInterval(tick, NEARBY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [current]);

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
          showsUserLocation
          showsMyLocationButton={false}
        >
          {nearbyDrivers.map((d, i) => (
            <Marker
              key={`nearby-${i}`}
              coordinate={{ latitude: d.lat, longitude: d.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              // Non-interactive ambient dots — don't intercept taps or show a callout.
              tappable={false}
            >
              <CarMarker variant="nearby" heading={d.heading} />
            </Marker>
          ))}
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
