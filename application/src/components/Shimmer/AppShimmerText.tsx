import React, { useMemo } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import AppShimmer from './AppShimmer';
import { SHIMMER_LINE_GAP, SHIMMER_LINE_HEIGHT, SHIMMER_RADIUS } from './shimmerTheme';

export interface AppShimmerTextProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  count?: number;
  spacing?: number;
  lastLineWidth?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const AppShimmerText: React.FC<AppShimmerTextProps> = ({
  width = '100%',
  height = SHIMMER_LINE_HEIGHT,
  radius = SHIMMER_RADIUS.sm,
  count = 1,
  spacing = SHIMMER_LINE_GAP,
  lastLineWidth = '60%',
  style,
  animated,
}) => {
  const lines = Math.max(1, count);
  const containerStyle = useMemo<StyleProp<ViewStyle>>(
    () => [{ rowGap: spacing }, style],
    [spacing, style],
  );

  return (
    <View
      style={containerStyle}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: lines }).map((_, index) => (
        <AppShimmer
          key={index}
          width={lines > 1 && index === lines - 1 ? lastLineWidth : width}
          height={height}
          radius={radius}
          animated={animated}
        />
      ))}
    </View>
  );
};

export default React.memo(AppShimmerText);
