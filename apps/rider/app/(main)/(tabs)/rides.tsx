import { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { useTripStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import type { Trip } from '@teeko/shared';
import { Icon, ScreenContainer, SkeletonRow, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { RideHistoryRow } from '../../../components/RideHistoryRow';

type Group = { label: string; key: string; trips: Trip[] };

function tripTimestamp(t: Trip): string {
  return t.completedAt ?? t.cancelledAt ?? t.createdAt;
}

function groupByMonth(trips: Trip[]): Group[] {
  const sorted = [...trips].sort(
    (a, b) => new Date(tripTimestamp(b)).getTime() - new Date(tripTimestamp(a)).getTime(),
  );
  const groups = new Map<string, Group>();
  for (const t of sorted) {
    const d = new Date(tripTimestamp(t));
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const g = groups.get(key);
    if (g) {
      g.trips.push(t);
    } else {
      groups.set(key, { key, label, trips: [t] });
    }
  }
  return Array.from(groups.values());
}

export default function RidesTab() {
  const router = useRouter();
  const t = useT();
  const history = useTripStore((s) => s.history);
  const historyLoading = useTripStore((s) => s.historyLoading);
  const loadHistory = useTripStore((s) => s.loadHistory);

  useEffect(() => {
    if (history.length === 0) loadHistory();
  }, [history.length, loadHistory]);

  const groups = useMemo(() => groupByMonth(history), [history]);
  const showSkeleton = historyLoading && history.length === 0;

  const onPress = (trip: Trip) => {
    router.push(`/(main)/receipt/${trip.id}`);
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View className="pb-2 pt-2">
        <Text weight="bold" className="text-3xl">
          {t('rides.title')}
        </Text>
      </View>

      {showSkeleton ? (
        <View className="-mx-gutter mt-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : groups.length === 0 ? (
        <View className="flex-1 items-center justify-center px-gutter">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon name="directions-car" size={32} color="#9CA3AF" />
          </View>
          <Text weight="medium" className="mt-4 text-base">
            {t('rides.emptyTitle')}
          </Text>
          <Text tone="secondary" className="mt-1 text-center text-sm">
            {t('rides.emptyBody')}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="-mx-gutter"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((g) => (
            <View key={g.key} className="mt-4">
              <Text
                weight="bold"
                className="px-gutter pb-2 text-sm uppercase tracking-wide text-ink-secondary"
              >
                {g.label}
              </Text>
              {g.trips.map((t) => (
                <RideHistoryRow key={t.id} trip={t} onPress={onPress} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
