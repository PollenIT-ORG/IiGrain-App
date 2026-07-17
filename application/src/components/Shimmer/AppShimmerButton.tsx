import React from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import AppShimmer from './AppShimmer';
import { SHIMMER_RADIUS, SHIMMER_SIZES } from './shimmerTheme';

export interface AppShimmerButtonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const AppShimmerButton: React.FC<AppShimmerButtonProps> = ({
  width = '100%',
  height = SHIMMER_SIZES.buttonHeight,
  radius = SHIMMER_RADIUS.lg,
  style,
  animated,
}) => (
  <AppShimmer width={width} height={height} radius={radius} style={style} animated={animated} />
);

export default React.memo(AppShimmerButton);
