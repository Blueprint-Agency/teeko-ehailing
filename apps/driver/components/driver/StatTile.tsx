import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react-native';
import { useColors } from '../../constants/colors';

export type StatTileProps = {
  icon: LucideIcon;
  /** One of the palette's *Tint tokens — the wash behind the icon chip. */
  tint: string;
  /** Solid colour the tint was derived from, used for the icon stroke. */
  iconColor: string;
  value: string;
  label: string;
  /**
   * Percent change against the previous period. Leave undefined until the
   * earnings API sends prior-period totals — the pill is simply omitted.
   */
  trendPct?: number | null;
  /** For metrics where a fall is the good outcome (cancellations, disputes). */
  invertTrend?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * One metric in the earnings stat grid: icon chip, figure, label, and an
 * optional trend pill. Deliberately dumb — callers format the value, because
 * currency, counts and durations all render differently.
 */
export default function StatTile({
  icon: Icon,
  tint,
  iconColor,
  value,
  label,
  trendPct,
  invertTrend = false,
  style,
}: StatTileProps) {
  const colors = useColors();
  const styles = createStyles(colors);

  // Zero is a real reading ("flat"), so only null/undefined and the divide-by-
  // zero case that a first-ever period produces are treated as "no trend yet".
  const hasTrend = trendPct != null && Number.isFinite(trendPct);
  const rising = hasTrend && trendPct > 0;
  const good = invertTrend ? !rising : rising;
  const TrendIcon = rising ? TrendingUp : TrendingDown;

  return (
    <View style={[styles.tile, style]}>
      {/* Icon and figure share a line; the label and trend sit beneath so the
          top row stays readable at half a phone's width. */}
      <View style={styles.topRow}>
        <View style={[styles.chip, { backgroundColor: tint }]}>
          <Icon size={15} color={iconColor} strokeWidth={2.2} />
        </View>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {value}
        </Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>

        {hasTrend && trendPct !== 0 && (
          <View
            style={[
              styles.trendPill,
              { backgroundColor: good ? colors.successTint : colors.dangerTint },
            ]}
          >
            <TrendIcon size={11} color={good ? colors.success : colors.danger} strokeWidth={2.6} />
            <Text style={[styles.trendText, { color: good ? colors.success : colors.danger }]}>
              {Math.abs(trendPct).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: colors.shadowColor,
    shadowOpacity: colors.shadowOpacity,
    shadowRadius: colors.shadowRadius,
    shadowOffset: { width: 0, height: 4 },
    elevation: colors.shadowElevation,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  chip: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  trendText: { fontSize: 11, fontWeight: '700' },
  // Takes the space the chip leaves and shrinks to fit rather than truncating —
  // a clipped ringgit figure is worse than a slightly smaller one.
  value: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  label: { flexShrink: 1, color: colors.textSec, fontSize: 12 },
});
