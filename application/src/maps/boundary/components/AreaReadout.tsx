import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon } from '../../../components/AppIcon';
import AppText from '../../../components/AppText/AppText';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  shadows,
  spacing,
} from '../../../constants';
import { moderateScale } from '../../../utils';
import { formatArea, type AreaUnit } from '../../utils/geo';

const UNIT_CYCLE: readonly AreaUnit[] = ['acre', 'hectare', 'sqm', 'sqft'];

export interface AreaReadoutProps {
  areaSqM: number;
  unit: AreaUnit;
  onCycleUnit: (next: AreaUnit) => void;
  vertexCount?: number;
}

export const nextAreaUnit = (unit: AreaUnit): AreaUnit =>
  UNIT_CYCLE[(UNIT_CYCLE.indexOf(unit) + 1) % UNIT_CYCLE.length];

const AreaReadout: React.FC<AreaReadoutProps> = ({
  areaSqM,
  unit,
  onCycleUnit,
  vertexCount,
}) => {
  const cycle = useCallback(() => onCycleUnit(nextAreaUnit(unit)), [onCycleUnit, unit]);

  return (
    <Pressable
      onPress={cycle}
      style={styles.chip}
      accessibilityRole="button"
      accessibilityLabel={`Area ${formatArea(areaSqM, unit)}. Tap to change unit.`}>
      {typeof vertexCount === 'number' ? (
        <View style={styles.countGroup}>
          <View style={styles.dot} />
          <AppText style={styles.count}>{vertexCount}</AppText>
        </View>
      ) : null}
      <AppText style={styles.area}>{areaSqM > 0 ? formatArea(areaSqM, unit) : '—'}</AppText>
      <AppIcon name="swap-horizontal" size={moderateScale(14)} color={COLORS.gray500} />
    </Pressable>
  );
};

export default React.memo(AreaReadout);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.md,
  },
  countGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  dot: {
    width: moderateScale(7),
    height: moderateScale(7),
    borderRadius: moderateScale(4),
    backgroundColor: COLORS.primary,
  },
  count: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.gray700 },
  area: { ...presets.labelMD, fontFamily: fonts.semibold, color: COLORS.gray900 },
});
