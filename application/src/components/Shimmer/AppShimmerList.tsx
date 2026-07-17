import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import AppShimmerRow from './AppShimmerRow';
import { SHIMMER_ITEM_GAP } from './shimmerTheme';

export interface ShimmerItemProps {
  animated?: boolean;
}

export interface AppShimmerListProps {
  count?: number;
  spacing?: number;
  ItemComponent?: React.ComponentType<ShimmerItemProps>;
  renderItem?: (index: number) => React.ReactNode;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const AppShimmerList: React.FC<AppShimmerListProps> = ({
  count = 6,
  spacing = SHIMMER_ITEM_GAP,
  ItemComponent,
  renderItem,
  style,
  animated,
}) => {
  const items = Math.max(1, count);
  const containerStyle = useMemo<StyleProp<ViewStyle>>(
    () => [{ rowGap: spacing }, style],
    [spacing, style],
  );

  const renderOne = (index: number): React.ReactNode => {
    if (renderItem) {
      return renderItem(index);
    }
    if (ItemComponent) {
      return <ItemComponent animated={animated} />;
    }
    return <AppShimmerRow animated={animated} />;
  };

  return (
    <View
      style={containerStyle}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: items }).map((_, index) => (
        <View key={index}>{renderOne(index)}</View>
      ))}
    </View>
  );
};

export default React.memo(AppShimmerList);
