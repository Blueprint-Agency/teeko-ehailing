import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import * as Location from 'expo-location';

import { useLocationStore } from '@teeko/api';
import { MapView, type MapViewHandle } from '@teeko/maps';
import type { LatLng, Place } from '@teeko/shared';
import { Button, Icon, Text } from '@teeko/ui';

import { DestinationPin } from './MapPins';
import { WhereToBar } from './WhereToBar';

// Kuala Lumpur city centre — fallback when we don't yet have the rider's location.
const KL_CENTER: LatLng = { lat: 3.139, lng: 101.6869 };

function addressFromGeocode(
  r: Location.LocationGeocodedAddress | undefined,
): { name: string; address: string } | null {
  if (!r) return null;
  const name = [r.name, r.street].filter(Boolean).join(' ').trim();
  const address = [r.name, r.street, r.city, r.region].filter(Boolean).join(', ');
  return { name: name || address || 'Dropped pin', address: address || 'Dropped pin' };
}

export interface DestinationMapCardProps {
  /** Fired when the rider confirms the pin as their trip destination. */
  onConfirm: (place: Place) => void;
  /** Fired when the rider taps the "Where to?" search bar overlaid on the map. */
  onSearchPress: () => void;
  searchPlaceholder: string;
  hint: string;
  confirmLabel: string;
  locatingLabel: string;
}

/**
 * A compact map with a fixed pin pinned to the map's centre. As the rider drags
 * the map, the pin stays put over the centre coordinate; when the map settles we
 * reverse-geocode that coordinate into an address and let the rider set it as
 * their trip destination. Mirrors the "drag map to pick a spot" pattern used by
 * Grab/Bolt for imprecise drop-offs.
 */
export function DestinationMapCard({
  onConfirm,
  onSearchPress,
  searchPlaceholder,
  hint,
  confirmLabel,
  locatingLabel,
}: DestinationMapCardProps) {
  const current = useLocationStore((s) => s.current);
  const mapRef = useRef<MapViewHandle>(null);

  // At least half the screen. Clamped to a sensible floor for very short devices.
  const { height: screenHeight } = useWindowDimensions();
  const cardHeight = Math.max(320, Math.round(screenHeight * 0.55));

  const start = current ?? KL_CENTER;
  const [center, setCenter] = useState<LatLng>(start);
  const [place, setPlace] = useState<Place | null>(null);
  const [resolving, setResolving] = useState(true);

  // Ignore stale reverse-geocode responses: only the newest request's result wins.
  const requestId = useRef(0);

  const initialRegion = useMemo(
    () => ({
      latitude: start.lat,
      longitude: start.lng,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }),
    // Region is seeded once; recentring on later location updates is handled by
    // the "my location" button, not by remounting the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const resolve = async (coord: LatLng) => {
    const id = ++requestId.current;
    setResolving(true);
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: coord.lat,
        longitude: coord.lng,
      });
      if (id !== requestId.current) return; // superseded by a newer drag
      const parsed = addressFromGeocode(results[0]);
      setPlace({
        id: `map-${coord.lat.toFixed(5)},${coord.lng.toFixed(5)}`,
        name: parsed?.name ?? 'Dropped pin',
        address: parsed?.address ?? 'Dropped pin',
        lat: coord.lat,
        lng: coord.lng,
      });
    } catch {
      if (id !== requestId.current) return;
      // Reverse geocode failed — still allow booking to the raw coordinate.
      setPlace({
        id: `map-${coord.lat.toFixed(5)},${coord.lng.toFixed(5)}`,
        name: 'Dropped pin',
        address: 'Dropped pin',
        lat: coord.lat,
        lng: coord.lng,
      });
    } finally {
      if (id === requestId.current) setResolving(false);
    }
  };

  // Resolve the starting centre once on mount.
  useEffect(() => {
    resolve(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      className="overflow-hidden border-y border-border bg-muted"
      style={{ height: cardHeight }}
    >
      <MapView
        ref={mapRef}
        initialRegion={initialRegion}
        showsUserLocation
        scrollEnabled
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={(region) => {
          const next = { lat: region.latitude, lng: region.longitude };
          setCenter(next);
          resolve(next);
        }}
      />

      {/* "Where to?" search bar floated over the top of the map. */}
      <View className="absolute left-0 right-0 top-0 px-gutter pt-3">
        <View
          className="rounded-full bg-surface"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        >
          <WhereToBar onPress={onSearchPress} placeholder={searchPlaceholder} />
        </View>
      </View>

      {/* Fixed centre pin — pointerEvents none so it never intercepts map drags.
          Lifted half its height so the dot sits over the map centre. */}
      <View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center"
      >
        <View style={{ transform: [{ translateY: -16 }] }}>
          <DestinationPin />
        </View>
      </View>

      {/* Address + confirm bar overlaid on the bottom of the map. */}
      <View className="absolute bottom-0 left-0 right-0 p-3">
        <View className="rounded-xl bg-surface p-3 shadow-sm">
          <View className="flex-row items-center">
            <Icon name="place" size={16} color="#16A34A" />
            <View className="ml-2 flex-1">
              {resolving ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#111111" />
                  <Text tone="secondary" className="ml-2 text-sm">
                    {locatingLabel}
                  </Text>
                </View>
              ) : (
                <Text weight="medium" className="text-sm" numberOfLines={1}>
                  {place?.name ?? hint}
                </Text>
              )}
              <Text tone="secondary" className="text-xs" numberOfLines={1}>
                {resolving ? '' : hint}
              </Text>
            </View>
          </View>
          <View className="mt-3">
            <Button
              label={confirmLabel}
              disabled={!place || resolving}
              onPress={() => place && onConfirm(place)}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
