import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useT } from '@teeko/i18n';
import { useColors } from '../../constants/colors';
import type { EarningsPeriod } from '../../lib/api';

const OPTIONS: Array<{ value: EarningsPeriod; labelKey: string }> = [
  { value: 'day', labelKey: 'driver.periodDay' },
  { value: 'week', labelKey: 'driver.periodWeek' },
  { value: 'month', labelKey: 'driver.periodMonth' },
];

/** Segmented control switching the earnings dashboard between time windows. */
export default function PeriodSelector({
  value,
  onChange,
  /** Dimmed while a fetch for the newly picked period is in flight. */
  disabled = false,
}: {
  value: EarningsPeriod;
  onChange: (period: EarningsPeriod) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const t = useT();
  const styles = createStyles(colors);

  return (
    <View style={[styles.track, disabled && styles.trackDisabled]}>
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, active && styles.segmentActive]}
            activeOpacity={0.8}
            disabled={disabled}
            // Re-selecting the current period would refetch for nothing.
            onPress={() => !active && onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{t(opt.labelKey)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    padding: 4,
    marginBottom: 12,
  },
  trackDisabled: { opacity: 0.6 },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.surface },
  label: { color: colors.textSec, fontSize: 13, fontWeight: '600' },
  labelActive: { color: colors.accent, fontWeight: '800' },
});
