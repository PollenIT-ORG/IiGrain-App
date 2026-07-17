import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '../AppText/AppText';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';

export interface SummaryRow {
  label: string;
  value: string;
}

interface PerformanceSummaryCardProps {
  rows: SummaryRow[];
}

const PerformanceSummaryCard: React.FC<PerformanceSummaryCardProps> = ({ rows }) => (
  <View style={styles.card}>
    {rows.map((r, i) => (
      <View
        key={r.label}
        style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
        <AppText style={styles.label} numberOfLines={1}>
          {r.label}
        </AppText>
        <AppText style={styles.value} numberOfLines={1}>
          {r.value}
        </AppText>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingHorizontal: spacing[4],
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing[3.5],
  },
  rowBorder: { borderBottomWidth: borderWidth.hairline, borderBottomColor: COLORS.gray200 },
  label: { ...presets.bodySM, color: COLORS.gray600, flex: 1 },
  value: { ...presets.labelMD, color: COLORS.gray900 },
});

export default PerformanceSummaryCard;
