import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Shimmer } from 'react-native-fast-shimmer';
import { SHIMMER_BASE_COLOR, SHIMMER_LINE_HEIGHT, SHIMMER_RADIUS } from './shimmerTheme';

export interface AppShimmerProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const AppShimmer: React.FC<AppShimmerProps> = ({
  width = '100%',
  height = SHIMMER_LINE_HEIGHT,
  radius,
  style,
  animated = true,
}) => {
  const box = useMemo<StyleProp<ViewStyle>>(
    () => [styles.base, { width, height, borderRadius: radius ?? SHIMMER_RADIUS.md }, style],
    [width, height, radius, style],
  );

  return (
    <View
      style={box}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {animated ? <Shimmer style={styles.fill} /> : null}
    </View>
  );
};

export default React.memo(AppShimmer);

const styles = StyleSheet.create({
  base: {
    backgroundColor: SHIMMER_BASE_COLOR,
    overflow: 'hidden',
  },
  fill: StyleSheet.absoluteFillObject,
});
