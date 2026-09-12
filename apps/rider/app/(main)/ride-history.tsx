import { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { useTripStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import type { Trip } from '@teeko/shared';
import { Icon, Pill, Pressable, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { TripFilterBar } from '../../components/TripFilterBar';
import { TripHistoryRow } from '../../components/TripHistoryRow';

/**
 * Full ride history: server-side status/period filters over a paged list.
 * The rides tab shows the unfiltered first page and links here.
 */
export default function RideHistoryScreen() {
  const t = useT();
  const router = useRouter();

  const history = useTripStore((s) => s.history);
  const historyLoading = useTripStore((s) => s.historyLoading);
  const historyLoadingMore = useTripStore((s) => s.historyLoadingMore);
  const historyHasMore = useTripStore((s) => s.historyHasMore);
  const historyTotal = useTripStore((s) => s.historyTotal);
  const filters = useTripStore((s) => s.historyFilters);
  const loadHistory = useTripStore((s) => s.loadHistory);
  const loadMoreHistory = useTripStore((s) => s.loadMoreHistory);
  const setHistoryFilters = useTripStore((s) => s.setHistoryFilters);

  // Load once on mount only — re-running on focus would reset a rider's scroll
  // position (and their loaded pages) every time they come back from a receipt.
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filtersActive = !!filters.status || !!filters.days;
  const isEmpty = history.length === 0;

  const renderItem = useCallback(
    ({ item }: { item: Trip }) => (
      <TripHistoryRow
        trip={item}
        t={t}
        onPress={() => router.push(`/(main)/receipt/${item.id}`)}
      />
    ),
    [router, t],
  );

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View className="flex-row items-center px-gutter pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="mr-2 h-10 w-10 items-center justify-center rounded-full active:bg-muted"
        >
          <Icon name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text weight="bold" className="text-xl">
          {t('rides.history.title')}
        </Text>
      </View>

      <View className="pb-3">
        <TripFilterBar
          status={filters.status}
          days={filters.days}
          t={t}
          onChange={(next) => setHistoryFilters(next)}
        />
      </View>

      {historyLoading && isEmpty ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : isEmpty ? (
        <View className="flex-1 items-center px-8 pt-16">
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon name="search" size={28} color="#666" />
          </View>
          <Text weight="bold" className="text-center text-lg">
            {filtersActive ? t('rides.filters.noMatchTitle') : t('rides.emptyTitle')}
          </Text>
          <Text tone="secondary" className="mt-2 text-center text-base">
            {filtersActive ? t('rides.filters.noMatchBody') : t('rides.emptyBody')}
          </Text>
          {filtersActive ? (
            <Pill
              size="sm"
              className="mt-5"
              onPress={() => setHistoryFilters({ status: undefined, days: undefined })}
            >
              {t('rides.filters.clear')}
            </Pill>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(trip) => trip.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={historyLoading}
              onRefresh={loadHistory}
              tintColor="#E11D2E"
            />
          }
          ListHeaderComponent={
            <Text
              tone="secondary"
              className="px-gutter pb-2 text-xs uppercase tracking-wide"
            >
              {t('rides.history.count', { count: historyTotal })}
            </Text>
          }
          // Fetch the next page a little before the rider hits the bottom.
          onEndReachedThreshold={0.4}
          onEndReached={() => loadMoreHistory()}
          ListFooterComponent={
            historyLoadingMore ? (
              <View className="items-center py-6">
                <ActivityIndicator color="#E11D2E" />
              </View>
            ) : historyHasMore ? (
              <View className="items-center py-6">
                <Pill size="sm" onPress={() => loadMoreHistory()}>
                  {t('rides.history.loadMore')}
                </Pill>
              </View>
            ) : (
              <Text tone="secondary" className="py-6 text-center text-xs">
                {t('rides.history.end')}
              </Text>
            )
          }
        />
      )}
    </ScreenContainer>
  );
}
