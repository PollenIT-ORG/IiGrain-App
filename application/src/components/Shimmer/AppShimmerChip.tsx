import React from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import AppShimmer from './AppShimmer';
import { SHIMMER_RADIUS, SHIMMER_SIZES } from './shimmerTheme';

export interface AppShimmerChipProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const AppShimmerChip: React.FC<AppShimmerChipProps> = ({
  width = SHIMMER_SIZES.chipWidth,
  height = SHIMMER_SIZES.chipHeight,
  radius = SHIMMER_RADIUS.pill,
  style,
  animated,
}) => (
  <AppShimmer width={width} height={height} radius={radius} style={style} animated={animated} />
);

export default React.memo(AppShimmerChip);
