import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';

import { usePlacesStore, useTripStore } from '@teeko/api';
import type { Place } from '@teeko/shared';
import { Icon, Input, Pressable, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { RecentPlaceRow } from '../../components/RecentPlaceRow';
import { SavedPlaceRow } from '../../components/SavedPlaceRow';

export default function SearchScreen() {
  const router = useRouter();
  const pickup = useTripStore((s) => s.pickup);
  const setDestination = useTripStore((s) => s.setDestination);
  const recent = usePlacesStore((s) => s.recent);
  const saved = usePlacesStore((s) => s.saved);
  const results = usePlacesStore((s) => s.results);
  const searching = usePlacesStore((s) => s.searching);
  const search = usePlacesStore((s) => s.search);
  const clearResults = usePlacesStore((s) => s.clearResults);
  const pushRecent = usePlacesStore((s) => s.pushRecent);

  const [pickupText, setPickupText] = useState(pickup?.name ?? 'Current location');
  const [query, setQuery] = useState('');

  const debounced = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounced.current) clearTimeout(debounced.current);
    const q = query.trim();
    if (!q) {
      clearResults();
      return;
    }
    debounced.current = setTimeout(() => search(q), 250);
    return () => {
      if (debounced.current) clearTimeout(debounced.current);
    };
  }, [query, search, clearResults]);

  const homePlace = useMemo(() => saved.find((p) => p.category === 'home'), [saved]);
  const workPlace = useMemo(() => saved.find((p) => p.category === 'work'), [saved]);

  const onSelectPlace = (place: Place) => {
    pushRecent(place);
    setDestination(place);
    router.push('/(main)/confirm-destination');
  };

  const showingResults = query.trim().length > 0;

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable onPress={() => router.back()} haptic="selection" className="-ml-2 p-2">
          <Icon name="arrow-back" size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-2 text-lg">
          Set destination
        </Text>
      </View>

      <View className="gap-3">
        <Input
          label="Pickup"
          value={pickupText}
          onChangeText={setPickupText}
          leadingIcon="my-location"
          placeholder="Pickup location"
        />
        <Input
          label="Destination"
          value={query}
          onChangeText={setQuery}
          leadingIcon="place"
          placeholder="Where to?"
          autoFocus
        />
      </View>

      {showingResults ? (
        <View className="-mx-gutter mt-4 flex-1">
          {searching ? (
            <View className="flex-row items-center px-gutter py-3">
              <Spinner />
              <Text tone="secondary" className="ml-3 text-sm">
                Searching…
              </Text>
            </View>
          ) : results.length === 0 ? (
            <View className="items-center px-gutter py-8">
              <Icon name="search-off" size={32} color="#9CA3AF" />
              <Text tone="secondary" className="mt-2 text-sm">
                No places match "{query}"
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <RecentPlaceRow place={item} onPress={onSelectPlace} />}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      ) : (
        <View className="mt-4 flex-1">
          <View className="-mx-gutter">
            <SavedPlaceRow kind="home" place={homePlace} onPress={(_, p) => p && onSelectPlace(p)} />
            <SavedPlaceRow kind="work" place={workPlace} onPress={(_, p) => p && onSelectPlace(p)} />
          </View>

          {recent.length > 0 ? (
            <>
              <Text weight="bold" className="mt-6 px-1 text-sm">
                Recent
              </Text>
              <View className="-mx-gutter mt-1">
                {recent.map((place) => (
                  <RecentPlaceRow key={place.id} place={place} onPress={onSelectPlace} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      )}
    </ScreenContainer>
  );
}
