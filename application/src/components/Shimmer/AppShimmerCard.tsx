import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS, borderRadius, borderWidth, spacing } from '../../constants';
import AppShimmerButton from './AppShimmerButton';
import AppShimmerImage from './AppShimmerImage';
import AppShimmerText from './AppShimmerText';

export interface AppShimmerCardProps {
  children?: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

const DefaultCardBody: React.FC<{ animated?: boolean }> = ({ animated }) => (
  <View style={styles.defaultBody}>
    <AppShimmerImage height={spacing[28]} animated={animated} />
    <AppShimmerText count={2} width="90%" lastLineWidth="60%" animated={animated} />
    <AppShimmerButton width="45%" animated={animated} />
  </View>
);

const AppShimmerCard: React.FC<AppShimmerCardProps> = ({
  children,
  padded = true,
  style,
  animated,
}) => {
  const cardStyle = useMemo<StyleProp<ViewStyle>>(
    () => [styles.card, padded && styles.padded, style],
    [padded, style],
  );

  return (
    <View
      style={cardStyle}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {children ?? <DefaultCardBody animated={animated} />}
    </View>
  );
};

export default React.memo(AppShimmerCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing[4],
  },
  defaultBody: {
    rowGap: spacing[3],
  },
});
