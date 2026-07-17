import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import AppShimmerCircle from './AppShimmerCircle';
import AppShimmerText from './AppShimmerText';
import { SHIMMER_ITEM_GAP, SHIMMER_SIZES } from './shimmerTheme';
import { scale } from '../../utils';

export interface AppShimmerRowProps {
  showLeading?: boolean;
  leadingSize?: number;
  lines?: number;
  showTrailing?: boolean;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const AppShimmerRow: React.FC<AppShimmerRowProps> = ({
  showLeading = true,
  leadingSize = SHIMMER_SIZES.avatar,
  lines = 2,
  showTrailing = false,
  style,
  animated,
}) => {
  const rowStyle = useMemo<StyleProp<ViewStyle>>(() => [styles.row, style], [style]);

  return (
    <View
      style={rowStyle}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {showLeading ? <AppShimmerCircle size={leadingSize} animated={animated} /> : null}
      <View style={styles.body}>
        <AppShimmerText count={lines} width="80%" lastLineWidth="55%" animated={animated} />
      </View>
      {showTrailing ? <AppShimmerCircle size={scale(20)} animated={animated} /> : null}
    </View>
  );
};

export default React.memo(AppShimmerRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SHIMMER_ITEM_GAP,
  },
  body: {
    flex: 1,
  },
});
