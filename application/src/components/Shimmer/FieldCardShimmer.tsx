import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, borderRadius, borderWidth, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppShimmer from './AppShimmer';
import AppShimmerChip from './AppShimmerChip';
import { SHIMMER_RADIUS } from './shimmerTheme';
import type { ShimmerItemProps } from './AppShimmerList';

const FieldCardShimmer: React.FC<ShimmerItemProps> = ({ animated }) => (
  <View
    style={styles.card}
    pointerEvents="none"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants">
    <AppShimmer width={scale(44)} height={scale(44)} radius={SHIMMER_RADIUS.lg} animated={animated} />

    <View style={styles.body}>
      <View style={styles.topRow}>
        <AppShimmer width="45%" height={moderateScale(14)} radius={SHIMMER_RADIUS.sm} animated={animated} />
        <AppShimmerChip width={scale(58)} height={scale(22)} animated={animated} />
      </View>
      <View style={styles.chipRow}>
        <AppShimmer width={scale(66)} height={scale(24)} radius={SHIMMER_RADIUS.md} animated={animated} />
        <AppShimmer width={scale(78)} height={scale(24)} radius={SHIMMER_RADIUS.md} animated={animated} />
      </View>
    </View>

    <AppShimmer width={scale(10)} height={scale(18)} radius={SHIMMER_RADIUS.sm} animated={animated} />
  </View>
);

export default React.memo(FieldCardShimmer);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
  },
  body: {
    flex: 1,
    gap: spacing[2],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
});
