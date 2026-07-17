import React, { useMemo } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '../../constants';
import { moderateScale } from '../../utils';
import AppShimmer from './AppShimmer';
import { SHIMMER_RADIUS } from './shimmerTheme';

export interface AppShimmerSectionProps {
  titleWidth?: DimensionValue;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const AppShimmerSection: React.FC<AppShimmerSectionProps> = ({
  titleWidth = '40%',
  children,
  style,
  animated,
}) => {
  const sectionStyle = useMemo<StyleProp<ViewStyle>>(() => [styles.section, style], [style]);

  return (
    <View
      style={sectionStyle}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <AppShimmer
        width={titleWidth}
        height={moderateScale(14)}
        radius={SHIMMER_RADIUS.sm}
        style={styles.title}
        animated={animated}
      />
      {children}
    </View>
  );
};

export default React.memo(AppShimmerSection);

const styles = StyleSheet.create({
  section: {
    rowGap: spacing[3],
  },
  title: {
    marginBottom: spacing[1],
  },
});
