import { useMemo, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';

import {
  CurrentLocationButton,
  MapView,
  Marker,
  formatDistance,
  formatDuration,
  type MapViewHandle,
} from '@teeko/maps';
import { useLocationStore, useTripStore } from '@teeko/api';
import type { LatLng } from '@teeko/shared';
import { Button, Icon, Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

// Straight-line distance (metres) between two coords, with a detour factor so the
// estimate reads like a road trip rather than a crow's flight. Mock-phase only —
// replaced by the routes API once fares are wired end-to-end.
const DETOUR_FACTOR = 1.3;
const CITY_SPEED_MPS = 6.94; // ~25 km/h

function roadDistanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h)) * DETOUR_FACTOR;
}

export default function ConfirmDestinationScreen() {
  const router = useRouter();
  const destination = useTripStore((s) => s.destination);
  const setDestination = useTripStore((s) => s.setDestination);
  const setPickup = useTripStore((s) => s.setPickup);
  const currentLatLng = useLocationStore((s) => s.current);
  const mapRef = useRef<MapViewHandle>(null);

  // The rider already chose the destination on the search screen; this screen only
  // confirms it. The marker is anchored to that fixed coordinate — panning the map
  // does not move it.
  const target: LatLng | null = destination ?? currentLatLng;

  const distanceMeters = useMemo(
    () => (currentLatLng && destination ? roadDistanceMeters(currentLatLng, destination) : null),
    [currentLatLng, destination],
  );

  const confirm = () => {
    if (!destination || !currentLatLng) {
      router.back();
      return;
    }
    setPickup({
      id: 'current-location',
      name: 'My Location',
      address: 'Current Location',
      lat: currentLatLng.lat,
      lng: currentLatLng.lng,
    });
    setDestination(destination);
    router.push('/(main)/ride-selection');
  };

  const recenter = () => {
    if (!target) return;
    mapRef.current?.animateToRegion({
      latitude: target.lat,
      longitude: target.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  return (
    <View className="flex-1 bg-surface">
      <MapView
        ref={mapRef}
        initialRegion={target ? {
          latitude: target.lat,
          longitude: target.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : undefined}
      >
        {destination ? (
          <Marker
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            pinColor="#E11D2E"
            title={destination.name}
            description={destination.address}
          />
        ) : null}
      </MapView>

      <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0">
        <View className="flex-row items-center justify-between px-gutter pt-2">
          <Pressable
            onPress={() => router.back()}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface shadow-sm"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            }}
          >
            <Icon name="arrow-back" size={22} color="#111111" />
          </Pressable>
        </View>
      </SafeAreaView>

      <View pointerEvents="box-none" className="absolute bottom-40 right-gutter">
        <CurrentLocationButton onPress={recenter} />
      </View>

      <SafeAreaView edges={['bottom']} className="absolute bottom-0 left-0 right-0 bg-surface">
        <View className="rounded-t-2xl border-t border-border bg-surface px-gutter pb-4 pt-3">
          <View className="mb-3 h-1 w-9 self-center rounded-full bg-border" />
          <View className="flex-row items-start">
            <View className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: '#E11D2E' }} />
            <View className="ml-3 flex-1">
              <Text tone="secondary" className="text-xs">
                Destination
              </Text>
              <Text weight="bold" className="mt-0.5 text-xl" numberOfLines={2}>
                {destination?.name ?? 'Pick a location on the map'}
              </Text>
              {destination?.address ? (
                <Text tone="secondary" className="mt-1 text-sm" numberOfLines={2}>
                  {destination.address}
                </Text>
              ) : null}
            </View>
          </View>

          {distanceMeters != null ? (
            <View className="mt-3 flex-row items-center self-start rounded-full bg-muted px-3 py-1.5">
              <Icon name="directions-car" size={14} color="#111111" />
              <Text className="ml-1.5 text-xs" weight="medium">
                {formatDistance(distanceMeters)} · {formatDuration(distanceMeters / CITY_SPEED_MPS)}
              </Text>
            </View>
          ) : null}

          <View className="mt-4">
            <Button label="Confirm destination" onPress={confirm} disabled={!destination || !currentLatLng} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
