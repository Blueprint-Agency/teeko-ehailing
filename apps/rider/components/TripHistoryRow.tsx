import { ListRow, Text } from '@teeko/ui';
import type { Trip } from '@teeko/shared';

export function formatTripWhen(iso: string): string {
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

export interface TripHistoryRowProps {
  trip: Trip;
  t: (key: string) => string;
  onPress: () => void;
}

/** One trip in the rides tab / ride-history list. Shared so both stay in sync. */
export function TripHistoryRow({ trip, t, onPress }: TripHistoryRowProps) {
  const cancelled = trip.status === 'cancelled';
  const completed = trip.status === 'completed';

  const statusLabel = cancelled
    ? t('rides.cancelled')
    : completed
      ? t('rides.completed')
      : t('rides.inProgress');

  const when = formatTripWhen(trip.createdAt);
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
          className={
            cancelled ? 'text-base text-ink-secondary line-through' : 'text-base text-ink-primary'
          }
        >
          {`RM ${trip.fare.amountMyr.toFixed(2)}`}
        </Text>
      }
    />
  );
}
