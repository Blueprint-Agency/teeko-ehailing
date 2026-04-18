import { useEffect } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { useAuthStore, useLocationStore, usePlacesStore, useTripStore } from '@teeko/api';
import type { Place } from '@teeko/shared';
import { ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { RecentPlaceRow } from '../../../components/RecentPlaceRow';
import { RidesActionCard } from '../../../components/RidesActionCard';
import { WhereToBar } from '../../../components/WhereToBar';

export default function HomeTab() {
  const router = useRouter();
  const rider = useAuthStore((s) => s.rider);
  const recent = usePlacesStore((s) => s.recent);
  const loadRecent = usePlacesStore((s) => s.loadRecent);
  const loadSaved = usePlacesStore((s) => s.loadSaved);
  const setPickup = useTripStore((s) => s.setPickup);
  const setDestination = useTripStore((s) => s.setDestination);
  const currentLatLng = useLocationStore((s) => s.current);

  useEffect(() => {
    loadRecent();
    loadSaved();
  }, [loadRecent, loadSaved]);

  const openSearch = () => {
    seedPickup();
    router.push('/(main)/search');
  };

  const onRecentPress = (place: Place) => {
    seedPickup();
    setDestination(place);
    router.push('/(main)/confirm-destination');
  };

  // Seed pickup from current GPS when entering the flow (PRD §4.3: pickup defaults to GPS).
  const seedPickup = () => {
    setPickup({
      id: 'current',
      name: 'Current location',
      address: 'Using your GPS',
      lat: currentLatLng.lat,
      lng: currentLatLng.lng,
      category: 'recent',
    });
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Image
          source={require('../../../assets/teeko-icon.png')}
          style={{ width: 32, height: 32, borderRadius: 8 }}
          resizeMode="contain"
        />
        <Text weight="bold" tone="brand" className="ml-2 text-2xl">
          Teeko
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
      >
        <Text weight="bold" className="mt-4 text-3xl leading-tight">
          Travel Easily{'\n'}with Teeko.
        </Text>
        {rider?.name ? (
          <Text tone="secondary" className="mt-1 text-sm">
            Good to see you, {rider.name.split(' ')[0]}.
          </Text>
        ) : null}

        <View className="mt-6">
          <RidesActionCard onPress={openSearch} />
        </View>

        <View className="mt-4">
          <WhereToBar onPress={openSearch} />
        </View>

        <View className="mt-8">
          <Text weight="bold" className="mb-2 text-base">
            Recent places
          </Text>
          {recent.length === 0 ? (
            <Text tone="faint" className="py-4 text-sm">
              Your recent destinations will show up here.
            </Text>
          ) : (
            <View className="-mx-gutter">
              {recent.map((place, i) => (
                <View key={place.id}>
                  <RecentPlaceRow place={place} onPress={onRecentPress} />
                  {i === recent.length - 1 ? null : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
