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
  spacing,
} from '../../../constants';
import { moderateScale, scale } from '../../../utils';
import { formatArea, formatDistance, type AreaUnit } from '../../utils/geo';
import { nextAreaUnit } from './AreaReadout';

export interface BoundaryStatsProps {
  vertexCount: number;
  areaSqM: number;
  perimeterM: number;
  unit: AreaUnit;
  onCycleUnit: (next: AreaUnit) => void;
}

const BoundaryStats: React.FC<BoundaryStatsProps> = ({
  vertexCount,
  areaSqM,
  perimeterM,
  unit,
  onCycleUnit,
}) => {
  const cycle = useCallback(() => onCycleUnit(nextAreaUnit(unit)), [onCycleUnit, unit]);

  return (
    <View style={styles.row}>
      <View style={styles.cell}>
        <AppIcon
          name="map-marker-multiple-outline"
          size={moderateScale(15)}
          color={COLORS.primary}
        />
        <AppText style={styles.value}>{vertexCount}</AppText>
        <AppText style={styles.unit}>points</AppText>
      </View>

      <View style={styles.divider} />

      <Pressable
        onPress={cycle}
        style={styles.cell}
        accessibilityRole="button"
        accessibilityLabel={`Area ${formatArea(areaSqM, unit)}. Tap to change unit.`}>
        <AppIcon name="vector-square" size={moderateScale(15)} color={COLORS.primary} />
        <AppText style={styles.value}>{areaSqM > 0 ? formatArea(areaSqM, unit) : '—'}</AppText>
        <AppIcon name="swap-horizontal" size={moderateScale(13)} color={COLORS.gray500} />
      </Pressable>

      <View style={styles.divider} />

      <View style={styles.cell}>
        <AppIcon name="ruler" size={moderateScale(15)} color={COLORS.primary} />
        <AppText style={styles.value}>
          {perimeterM > 0 ? formatDistance(perimeterM) : '—'}
        </AppText>
      </View>
    </View>
  );
};

export default React.memo(BoundaryStats);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.lightPrimaryBg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.lightPrimary,
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    flex: 1,
    justifyContent: 'center',
  },
  divider: {
    width: borderWidth.thin,
    height: scale(18),
    backgroundColor: COLORS.gray200,
  },
  value: { ...presets.labelSM, fontFamily: fonts.semibold, color: COLORS.gray900 },
  unit: { ...presets.caption, color: COLORS.gray600 },
});
