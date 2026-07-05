import { useCallback } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useTripStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import type { Trip, TripStatus } from '@teeko/shared';
import { Icon, ListRow, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useFocusEffect, useRouter } from 'expo-router';

// Statuses that represent a ride still in progress / upcoming vs. a finished one.
const UPCOMING: TripStatus[] = ['pending', 'searching', 'matched', 'arrived', 'in_trip'];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RidesTab() {
  const t = useT();
  const router = useRouter();
  const history = useTripStore((s) => s.history);
  const historyLoading = useTripStore((s) => s.historyLoading);
  const loadHistory = useTripStore((s) => s.loadHistory);

  // Refresh whenever the tab gains focus (e.g. after completing a trip).
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  const upcoming = history.filter((tr) => UPCOMING.includes(tr.status));
  const past = history.filter((tr) => !UPCOMING.includes(tr.status));

  const isEmpty = history.length === 0;

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View className="px-gutter pb-4 pt-6">
        <Text weight="bold" className="text-2xl">
          {t('rides.title')}
        </Text>
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
            <RefreshControl refreshing={historyLoading} onRefresh={loadHistory} tintColor="#E11D2E" />
          }
        >
          {upcoming.length > 0 ? (
            <Section title={t('rides.upcoming')}>
              {upcoming.map((tr) => (
                <TripRow key={tr.id} trip={tr} t={t} onPress={() => router.push(`/(main)/receipt/${tr.id}`)} />
              ))}
            </Section>
          ) : null}

          {past.length > 0 ? (
            <Section title={t('rides.past')}>
              {past.map((tr) => (
                <TripRow key={tr.id} trip={tr} t={t} onPress={() => router.push(`/(main)/receipt/${tr.id}`)} />
              ))}
            </Section>
          ) : null}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function TripRow({ trip, t, onPress }: { trip: Trip; t: (key: string) => string; onPress: () => void }) {
  const cancelled = trip.status === 'cancelled';
  const completed = trip.status === 'completed';

  const statusLabel = cancelled
    ? t('rides.cancelled')
    : completed
      ? t('rides.completed')
      : t('rides.inProgress');

  const when = formatWhen(trip.createdAt);
  const subtitle = when ? `${when} · ${statusLabel}` : statusLabel;

  return (
    <ListRow
      leadingIcon={cancelled ? 'cancel' : 'directions-car'}
      title={trip.destination.address || trip.destination.name || '—'}
      subtitle={subtitle}
      onPress={onPress}
      trailing={
        <Text
          weight="bold"
          className={cancelled ? 'text-base text-ink-secondary line-through' : 'text-base text-ink-primary'}
        >
          {`RM ${trip.fare.amountMyr.toFixed(2)}`}
        </Text>
      }
    />
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
