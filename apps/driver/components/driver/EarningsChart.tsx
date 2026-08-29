import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useT } from '@teeko/i18n';
import { useColors } from '../../constants/colors';

export type EarningsColumn = {
  key: string;
  label: string;
  amountRm: number;
  trips: number;
  isCurrent: boolean;
};

const PLOT_HEIGHT = 148;
const AXIS_WIDTH = 38;
/** Fractions of the axis maximum that get a gridline and a label. */
const TICKS = [1, 2 / 3, 1 / 3, 0];
/**
 * Highest point, as a percentage of the plot, the popover may be anchored to.
 * The bubble and caret are roughly 55px tall in a 148px plot, so anything above
 * this would render off the top of the chart.
 */
const TOOLTIP_MAX_ANCHOR = 62;
/**
 * Fixed popover width. Without it the bubble is clamped to its column — barely
 * 30px wide on a seven-day chart — and the figure wraps. An explicit width is
 * not clamped by the parent, so the bubble overhangs its neighbours instead.
 */
const TOOLTIP_WIDTH = 104;

/**
 * Rounds the axis ceiling up to 1, 2, 5 or 10 × a power of ten, so the tick
 * labels land on readable figures instead of whatever the tallest bar happens
 * to be. Falls back to 10 when there is nothing to plot, giving an empty chart
 * a sensible scale rather than a divide-by-zero.
 */
function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

function axisLabel(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

/**
 * Bar chart for the earnings dashboard: gridlines with a rounded axis, and a
 * tap-to-inspect tooltip. Columns arrive oldest-first and are already bucketed
 * by the API — this only draws them.
 */
export default function EarningsChart({
  title,
  columns,
}: {
  title: string;
  columns: EarningsColumn[];
}) {
  const colors = useColors();
  const t = useT();
  const styles = createStyles(colors);
  const [selected, setSelected] = useState<string | null>(null);

  const max = niceMax(Math.max(...columns.map((c) => c.amountRm), 0));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.plotRow}>
        <View style={styles.axis}>
          {TICKS.map((t) => (
            <Text key={t} style={styles.axisText}>{axisLabel(max * t)}</Text>
          ))}
        </View>

        <View style={styles.plot}>
          {/* Gridlines sit behind the bars and must never eat a tap. */}
          <View style={styles.grid} pointerEvents="none">
            {TICKS.map((t) => (
              <View key={t} style={[styles.gridLine, t === 0 && styles.gridLineBase]} />
            ))}
          </View>

          <View style={styles.bars}>
            {columns.map((c) => {
              const isSelected = selected === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={styles.barColumn}
                  activeOpacity={0.7}
                  // Tapping the selected column again dismisses the tooltip.
                  onPress={() => setSelected(isSelected ? null : c.key)}
                >
                  <View
                    style={[
                      styles.bar,
                      { height: `${(c.amountRm / max) * 100}%` },
                      (c.isCurrent || isSelected) && styles.barActive,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Popover overlay: a mirror of the bar row, so the bubble lands over
              the column it describes without measuring anything. It floats just
              above the tapped bar's tip with a caret pointing back down at it. */}
          {selected != null && (
            <View style={styles.tooltipRow} pointerEvents="none">
              {columns.map((c, i) => {
                if (selected !== c.key) return <View key={c.key} style={styles.tooltipCell} />;
                // Clamped so a full-height bar doesn't push the popover out of
                // the plot; at the ceiling it simply rests on the bar's tip.
                const anchor = Math.min((c.amountRm / max) * 100, TOOLTIP_MAX_ANCHOR);
                // Edge columns hug their side rather than centring, which would
                // hang the bubble off the chart.
                const align =
                  i === 0 ? 'flex-start' : i === columns.length - 1 ? 'flex-end' : 'center';
                return (
                  <View key={c.key} style={[styles.tooltipCell, { alignItems: align }]}>
                    <View style={[styles.popover, { bottom: `${anchor}%` }]}>
                      <View style={styles.bubble}>
                        <Text style={styles.tooltipAmount} numberOfLines={1}>
                          RM {c.amountRm.toFixed(2)}
                        </Text>
                        {/* Two explicit keys rather than i18next pluralisation:
                            the four locales have different plural rules, and
                            zh/ms simply repeat the one form. */}
                        <Text style={styles.tooltipMeta} numberOfLines={1}>
                          {t(c.trips === 1 ? 'driver.tripCountOne' : 'driver.tripCountMany', {
                            count: c.trips,
                          })}
                        </Text>
                      </View>
                      <View style={[styles.caret, align === 'flex-start' && styles.caretStart,
                        align === 'flex-end' && styles.caretEnd]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <View style={styles.labelRow}>
        {/* Matches the axis column so the labels line up under their bars. */}
        <View style={styles.labelSpacer} />
        <View style={styles.labelCells}>
          {columns.map((c) => (
            <View key={c.key} style={styles.labelCell}>
              <Text style={[styles.label, c.isCurrent && styles.labelActive]} numberOfLines={1}>
                {c.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: colors.shadowColor,
    shadowOpacity: colors.shadowOpacity,
    shadowRadius: colors.shadowRadius,
    shadowOffset: { width: 0, height: 4 },
    elevation: colors.shadowElevation,
    marginBottom: 20,
  },
  title: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 16 },

  plotRow: { flexDirection: 'row' },
  axis: {
    width: AXIS_WIDTH,
    height: PLOT_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  // Nudged up by half a line-height so each label sits on its gridline rather
  // than hanging below it.
  axisText: { color: colors.textMut, fontSize: 10, fontWeight: '600', marginTop: -6 },

  plot: { flex: 1, height: PLOT_HEIGHT },
  grid: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  gridLine: { height: 1, backgroundColor: colors.borderSoft },
  gridLineBase: { backgroundColor: colors.border },

  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    minHeight: 2,
    backgroundColor: colors.surfaceTop,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barActive: { backgroundColor: colors.accent },

  tooltipRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', gap: 8 },
  tooltipCell: { flex: 1, alignItems: 'center' },
  // Anchored to the bar's tip. Absolute children honour the cell's alignItems
  // on the axis with no inset set, which is how edge columns shift sideways.
  popover: { position: 'absolute', width: TOOLTIP_WIDTH, marginBottom: 6 },
  bubble: {
    backgroundColor: colors.surfaceTop,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  // Downward caret, drawn with the usual collapsed-border triangle.
  caret: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.surfaceTop,
  },
  // Keep the caret over its bar when the bubble has been nudged to an edge.
  caretStart: { alignSelf: 'flex-start', marginLeft: 10 },
  caretEnd: { alignSelf: 'flex-end', marginRight: 10 },
  tooltipAmount: { color: colors.text, fontSize: 12, fontWeight: '800' },
  tooltipMeta: { color: colors.textSec, fontSize: 10, marginTop: 1 },

  labelRow: { flexDirection: 'row', marginTop: 8 },
  labelSpacer: { width: AXIS_WIDTH },
  labelCells: { flex: 1, flexDirection: 'row', gap: 8 },
  labelCell: { flex: 1, alignItems: 'center' },
  label: { color: colors.textSec, fontSize: 10, fontWeight: '600' },
  labelActive: { color: colors.accent },
});
