import { ScrollView, View } from 'react-native';

import type { TripHistoryStatusFilter } from '@teeko/shared';
import { Pill } from '@teeko/ui';

export const STATUS_FILTERS: Array<{ key?: TripHistoryStatusFilter; labelKey: string }> = [
  { key: undefined, labelKey: 'rides.filters.all' },
  { key: 'upcoming', labelKey: 'rides.upcoming' },
  { key: 'completed', labelKey: 'rides.completed' },
  { key: 'cancelled', labelKey: 'rides.cancelled' },
];

export const PERIOD_FILTERS: Array<{ days?: number; labelKey: string }> = [
  { days: undefined, labelKey: 'rides.filters.allTime' },
  { days: 7, labelKey: 'rides.filters.last7Days' },
  { days: 30, labelKey: 'rides.filters.last30Days' },
  { days: 90, labelKey: 'rides.filters.last3Months' },
];

export interface TripFilterBarProps {
  status?: TripHistoryStatusFilter;
  days?: number;
  onChange: (next: { status?: TripHistoryStatusFilter; days?: number }) => void;
  t: (key: string) => string;
}

/** The two chip rows above the ride-history list (status bucket + time range). */
export function TripFilterBar({ status, days, onChange, t }: TripFilterBarProps) {
  return (
    <View>
      <ChipRow>
        {STATUS_FILTERS.map((f) => (
          <Pill
            key={f.labelKey}
            size="sm"
            selected={status === f.key}
            onPress={() => onChange({ status: f.key, days })}
            className="mr-2"
          >
            {t(f.labelKey)}
          </Pill>
        ))}
      </ChipRow>
      <ChipRow className="pt-2">
        {PERIOD_FILTERS.map((f) => (
          <Pill
            key={f.labelKey}
            size="sm"
            selected={days === f.days}
            onPress={() => onChange({ status, days: f.days })}
            className="mr-2"
          >
            {t(f.labelKey)}
          </Pill>
        ))}
      </ChipRow>
    </View>
  );
}

function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={className}
      // Horizontal ScrollViews default to flexGrow:1 and would eat the list's space.
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ paddingLeft: 20, paddingRight: 12 }}
    >
      {children}
    </ScrollView>
  );
}
