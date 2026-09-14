import { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { useTripStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import type { TripStatus } from '@teeko/shared';
import { Icon, Pill, Pressable, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useFocusEffect, useRouter } from 'expo-router';

import { TripHistoryRow } from '../../../components/TripHistoryRow';

// Statuses that represent a ride still in progress / upcoming vs. a finished one.
const UPCOMING: TripStatus[] = ['pending', 'searching', 'matched', 'arrived', 'in_trip'];

export default function RidesTab() {
  const t = useT();
  const router = useRouter();
  const history = useTripStore((s) => s.history);
  const historyLoading = useTripStore((s) => s.historyLoading);
  const historyLoadingMore = useTripStore((s) => s.historyLoadingMore);
  const historyHasMore = useTripStore((s) => s.historyHasMore);
  const loadMoreHistory = useTripStore((s) => s.loadMoreHistory);
  const setHistoryFilters = useTripStore((s) => s.setHistoryFilters);

  // Refresh whenever the tab gains focus (e.g. after completing a trip). Clearing
  // the filters also reloads, so the tab always shows the unfiltered list even
  // after the rider filtered things down on the ride-history screen.
  useFocusEffect(
    useCallback(() => {
      setHistoryFilters({ status: undefined, days: undefined });
    }, [setHistoryFilters]),
  );

  const upcoming = history.filter((tr) => UPCOMING.includes(tr.status));
  const past = history.filter((tr) => !UPCOMING.includes(tr.status));

  const isEmpty = history.length === 0;
  const openReceipt = (id: string) => router.push(`/(main)/receipt/${id}`);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between px-gutter pb-4 pt-6">
        <Text weight="bold" className="text-2xl">
          {t('rides.title')}
        </Text>
        {!isEmpty ? (
          <Pressable
            onPress={() => router.push('/(main)/ride-history')}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t('rides.history.title')}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
          >
            <Icon name="tune" size={22} color="#111827" />
          </Pressable>
        ) : null}
      </View>

      {historyLoading && isEmpty ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : isEmpty ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Icon name="schedule" size={36} color="#666" />
          </View>
          <Text weight="bold" className="text-center text-2xl">
            {t('rides.emptyTitle')}
          </Text>
          <Text tone="secondary" className="mt-3 text-center text-base">
            {t('rides.emptyBody')}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="-mx-gutter"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={historyLoading}
              onRefresh={() => setHistoryFilters({ status: undefined, days: undefined })}
              tintColor="#E11D2E"
            />
          }
        >
          {upcoming.length > 0 ? (
            <Section title={t('rides.upcoming')}>
              {upcoming.map((tr) => (
                <TripHistoryRow key={tr.id} trip={tr} t={t} onPress={() => openReceipt(tr.id)} />
              ))}
            </Section>
          ) : null}

          {past.length > 0 ? (
            <Section title={t('rides.past')}>
              {past.map((tr) => (
                <TripHistoryRow key={tr.id} trip={tr} t={t} onPress={() => openReceipt(tr.id)} />
              ))}
            </Section>
          ) : null}

          {historyLoadingMore ? (
            <View className="items-center py-6">
              <ActivityIndicator color="#E11D2E" />
            </View>
          ) : historyHasMore ? (
            <View className="items-center py-6">
              <Pill size="sm" onPress={() => loadMoreHistory()}>
                {t('rides.history.loadMore')}
              </Pill>
            </View>
          ) : null}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text
        weight="bold"
        className="px-gutter pb-2 text-xs uppercase tracking-wide text-ink-secondary"
      >
        {title}
      </Text>
      <View className="border-y border-border bg-surface">{children}</View>
    </View>
  );
}
