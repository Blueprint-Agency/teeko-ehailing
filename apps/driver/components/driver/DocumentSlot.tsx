import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../../constants/colors';

interface Props {
  label: string;
  required?: boolean;
  hint?: string;
}

export default function DocumentSlot({ label, required, hint }: Props) {
  const colors = useColors();
  const [filled, setFilled] = useState(false);
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required && <Text style={styles.required}>Required</Text>}
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}

      <TouchableOpacity
        style={[styles.slot, filled && styles.slotFilled]}
        onPress={() => setFilled(!filled)}
        activeOpacity={0.8}
      >
        {filled ? (
          <View style={styles.filled}>
            <View style={styles.thumbnail}>
              <Text style={styles.thumbnailIcon}>📄</Text>
            </View>
            <View style={styles.filledInfo}>
              <Text style={styles.filledText}>Document uploaded</Text>
              <Text style={styles.retake}>Tap to retake</Text>
            </View>
            <View style={styles.checkBadge}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>＋</Text>
            <Text style={styles.emptyText}>Take Photo</Text>
            <Text style={styles.emptyOr}>or choose from gallery</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  required: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  hint: { color: colors.textSec, fontSize: 12, marginBottom: 8 },
  slot: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  slotFilled: {
    borderColor: colors.success,
    borderStyle: 'solid',
  },
  empty: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  emptyIcon: { fontSize: 24, color: colors.textMut, marginBottom: 4 },
  emptyText: { color: colors.textSec, fontSize: 14, fontWeight: '600' },
  emptyOr: { color: colors.textMut, fontSize: 12, marginTop: 2 },
  filled: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailIcon: { fontSize: 20 },
  filledInfo: { flex: 1, marginLeft: 12 },
  filledText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  retake: { color: colors.textSec, fontSize: 12, marginTop: 2 },
  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
