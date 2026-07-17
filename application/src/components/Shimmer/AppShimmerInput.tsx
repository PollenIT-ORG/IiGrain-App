import React, { useMemo } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import AppShimmer from './AppShimmer';
import {
  SHIMMER_LINE_GAP,
  SHIMMER_LINE_HEIGHT,
  SHIMMER_RADIUS,
  SHIMMER_SIZES,
} from './shimmerTheme';

export interface AppShimmerInputProps {
  withLabel?: boolean;
  labelWidth?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const AppShimmerInput: React.FC<AppShimmerInputProps> = ({
  withLabel = true,
  labelWidth = '32%',
  height = SHIMMER_SIZES.inputHeight,
  radius = SHIMMER_RADIUS.md,
  style,
  animated,
}) => {
  const containerStyle = useMemo<StyleProp<ViewStyle>>(
    () => [{ rowGap: SHIMMER_LINE_GAP }, style],
    [style],
  );

  return (
    <View
      style={containerStyle}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {withLabel ? (
        <AppShimmer
          width={labelWidth}
          height={SHIMMER_LINE_HEIGHT}
          radius={SHIMMER_RADIUS.sm}
          animated={animated}
        />
      ) : null}
      <AppShimmer width="100%" height={height} radius={radius} animated={animated} />
    </View>
  );
};

export default React.memo(AppShimmerInput);
