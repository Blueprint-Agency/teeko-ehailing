import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';

import { useLocationStore, usePlacesStore, useTripStore } from '@teeko/api';
import type { Place } from '@teeko/shared';
import { Icon, Input, Pressable, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { RecentPlaceRow } from '../../components/RecentPlaceRow';
import { SavedPlaceRow } from '../../components/SavedPlaceRow';

type SearchIntent = 'saveHome' | 'saveWork' | 'saveCustom' | undefined;

export default function SearchScreen() {
  const router = useRouter();
  const { intent: intentParam } = useLocalSearchParams<{ intent?: string }>();
  const intent: SearchIntent =
    intentParam === 'saveHome' ||
    intentParam === 'saveWork' ||
    intentParam === 'saveCustom'
      ? intentParam
      : undefined;

  const setDestination = useTripStore((s) => s.setDestination);
  const currentLatLng = useLocationStore((s) => s.current);

  const recent = usePlacesStore((s) => s.recent);
  const saved = usePlacesStore((s) => s.saved);
  const results = usePlacesStore((s) => s.results);
  const searching = usePlacesStore((s) => s.searching);
  const search = usePlacesStore((s) => s.search);
  const clearResults = usePlacesStore((s) => s.clearResults);
  const selectPrediction = usePlacesStore((s) => s.selectPrediction);
  const pushRecent = usePlacesStore((s) => s.pushRecent);
  const saveHomeOrWork = usePlacesStore((s) => s.saveHomeOrWork);

  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const debounced = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounced.current) clearTimeout(debounced.current);
    const q = query.trim();
    if (q.length < 2) {
      clearResults();
      return;
    }
    debounced.current = setTimeout(
      () => search(q, currentLatLng),
      250,
    );
    return () => {
      if (debounced.current) clearTimeout(debounced.current);
    };
  }, [query, search, clearResults, currentLatLng]);

  const homePlace = useMemo(() => saved.find((p) => p.category === 'home'), [saved]);
  const workPlace = useMemo(() => saved.find((p) => p.category === 'work'), [saved]);

  const onSelectPlace = async (place: Place) => {
    let resolved = place;
    // Search results have lat=0/lng=0; resolve them via Place Details first.
    if (place.category === 'search' && place.lat === 0 && place.lng === 0) {
      try {
        setResolving(true);
        resolved = await selectPrediction(place.id);
      } catch {
        setResolving(false);
        return;
      }
      setResolving(false);
    }

    if (intent === 'saveHome') {
      await saveHomeOrWork('home', resolved);
      router.back();
      return;
    }
    if (intent === 'saveWork') {
      await saveHomeOrWork('work', resolved);
      router.back();
      return;
    }
    if (intent === 'saveCustom') {
      await saveHomeOrWork('custom', resolved);
      router.back();
      return;
    }
    pushRecent(resolved);
    setDestination(resolved);
    router.push('/(main)/confirm-destination');
  };

  const headerTitle =
    intent === 'saveHome'
      ? 'Set home'
      : intent === 'saveWork'
        ? 'Set work'
        : intent === 'saveCustom'
          ? 'Add place'
          : 'Set destination';

  const showingResults = query.trim().length >= 2;

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable
          onPress={() => router.back()}
          haptic="selection"
          className="-ml-2 p-2"
        >
          <Icon name="arrow-back" size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-1 text-lg">
          {headerTitle}
        </Text>
      </View>

      <View className="pb-3">
        <Input
          placeholder="Search address or place"
          value={query}
          onChangeText={setQuery}
          autoFocus
          leadingIcon="search"
        />
      </View>

      {resolving ? (
        <View className="items-center py-3">
          <Spinner />
        </View>
      ) : null}

      {showingResults ? (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={results}
          keyExtractor={(p) => p.id}
          ListEmptyComponent={
            searching ? (
              <View className="items-center py-6">
                <Spinner />
              </View>
            ) : (
              <Text tone="secondary" className="py-6 text-center text-sm">
                No matches
              </Text>
            )
          }
          renderItem={({ item }) => (
            <RecentPlaceRow place={item} onPress={() => onSelectPlace(item)} />
          )}
        />
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={recent}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={
            intent === undefined ? (
              <View>
                {homePlace ? (
                  <SavedPlaceRow
                    kind="home"
                    place={homePlace}
                    onPress={(_kind, place) => place && onSelectPlace(place)}
                  />
                ) : null}
                {workPlace ? (
                  <SavedPlaceRow
                    kind="work"
                    place={workPlace}
                    onPress={(_kind, place) => place && onSelectPlace(place)}
                  />
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Text tone="secondary" className="py-6 text-center text-sm">
              Start typing to search
            </Text>
          }
          renderItem={({ item }) => (
            <RecentPlaceRow place={item} onPress={() => onSelectPlace(item)} />
          )}
        />
      )}
    </ScreenContainer>
  );
}
