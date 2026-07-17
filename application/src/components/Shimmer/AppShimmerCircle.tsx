import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import AppShimmer from './AppShimmer';
import { SHIMMER_SIZES } from './shimmerTheme';

export interface AppShimmerCircleProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const AppShimmerCircle: React.FC<AppShimmerCircleProps> = ({
  size = SHIMMER_SIZES.circle,
  style,
  animated,
}) => (
  <AppShimmer width={size} height={size} radius={size / 2} style={style} animated={animated} />
);

export default React.memo(AppShimmerCircle);
