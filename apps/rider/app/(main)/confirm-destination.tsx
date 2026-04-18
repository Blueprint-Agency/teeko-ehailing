import { useCallback, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';

import { CurrentLocationButton, type MapViewHandle } from '@teeko/maps';
import { useLocationStore, useTripStore } from '@teeko/api';
import type { LatLng } from '@teeko/shared';
import { Button, Icon, Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';
import type { Region } from 'react-native-maps';

import { MapWithPin } from '../../components/MapWithPin';

export default function ConfirmDestinationScreen() {
  const router = useRouter();
  const destination = useTripStore((s) => s.destination);
  const setDestination = useTripStore((s) => s.setDestination);
  const currentLatLng = useLocationStore((s) => s.current);
  const mapRef = useRef<MapViewHandle>(null);

  const origin: LatLng = destination ?? currentLatLng;
  const [pinCoord, setPinCoord] = useState<LatLng>(origin);

  const onRegionChange = useCallback((region: Region) => {
    setPinCoord({ lat: region.latitude, lng: region.longitude });
  }, []);

  const confirm = () => {
    if (!destination) {
      router.back();
      return;
    }
    setDestination({ ...destination, lat: pinCoord.lat, lng: pinCoord.lng });
    router.push('/(main)/ride-selection');
  };

  const recenter = () => {
    mapRef.current?.animateToRegion({
      latitude: origin.lat,
      longitude: origin.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  return (
    <View className="flex-1 bg-surface">
      <MapWithPin
        ref={mapRef}
        initialRegion={{
          latitude: origin.lat,
          longitude: origin.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onRegionChangeComplete={onRegionChange}
      />

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

      <SafeAreaView edges={['bottom']} className="absolute bottom-0 left-0 right-0">
        <View className="rounded-t-2xl border-t border-border bg-surface px-gutter pb-4 pt-5">
          <Text tone="secondary" className="text-xs">
            Destination
          </Text>
          <Text weight="bold" className="mt-1 text-xl" numberOfLines={2}>
            {destination?.name ?? 'Pick a location on the map'}
          </Text>
          {destination?.address ? (
            <Text tone="secondary" className="mt-1 text-sm" numberOfLines={2}>
              {destination.address}
            </Text>
          ) : null}
          <View className="mt-4">
            <Button label="Confirm destination" onPress={confirm} disabled={!destination} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
