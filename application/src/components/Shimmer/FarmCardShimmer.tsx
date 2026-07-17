import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, borderRadius, borderWidth, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppShimmer from './AppShimmer';
import AppShimmerChip from './AppShimmerChip';
import { SHIMMER_RADIUS } from './shimmerTheme';
import type { ShimmerItemProps } from './AppShimmerList';

const FarmCardShimmer: React.FC<ShimmerItemProps> = ({ animated }) => (
  <View
    style={styles.card}
    pointerEvents="none"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants">
    <View style={styles.topRow}>
      <AppShimmer width={scale(44)} height={scale(44)} radius={SHIMMER_RADIUS.md} animated={animated} />
      <View style={styles.identity}>
        <AppShimmer width="55%" height={moderateScale(15)} radius={SHIMMER_RADIUS.sm} animated={animated} />
        <AppShimmer width="38%" height={moderateScale(11)} radius={SHIMMER_RADIUS.sm} animated={animated} />
      </View>
      <AppShimmer width={scale(10)} height={scale(18)} radius={SHIMMER_RADIUS.sm} animated={animated} />
    </View>

    <View style={styles.bottomRow}>
      <View style={styles.metaGroup}>
        <AppShimmer width={scale(58)} height={moderateScale(12)} radius={SHIMMER_RADIUS.sm} animated={animated} />
        <AppShimmer width={scale(58)} height={moderateScale(12)} radius={SHIMMER_RADIUS.sm} animated={animated} />
      </View>
      <AppShimmerChip width={scale(58)} height={scale(22)} animated={animated} />
    </View>

    <View style={styles.footerRow}>
      <AppShimmer width={scale(120)} height={moderateScale(10)} radius={SHIMMER_RADIUS.sm} animated={animated} />
    </View>
  </View>
);

export default React.memo(FarmCardShimmer);

const styles = StyleSheet.create({
  card: {
    height: scale(150),
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    padding: spacing[4],
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  identity: {
    flex: 1,
    gap: spacing[2],
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
