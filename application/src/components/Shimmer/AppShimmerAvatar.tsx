import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import AppShimmer from './AppShimmer';
import { SHIMMER_SIZES } from './shimmerTheme';

export interface AppShimmerAvatarProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const AppShimmerAvatar: React.FC<AppShimmerAvatarProps> = ({
  size = SHIMMER_SIZES.avatar,
  style,
  animated,
}) => (
  <AppShimmer width={size} height={size} radius={size / 2} style={style} animated={animated} />
);

export default React.memo(AppShimmerAvatar);
