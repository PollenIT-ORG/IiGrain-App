import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { COLORS, borderRadius, spacing } from '../../constants';
import { scale } from '../../utils';

interface SkeletonBoxProps {
  width?: number | string;
  height: number;
  style?: object;
}

const SkeletonBox: React.FC<SkeletonBoxProps> = ({ width = '100%', height, style }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.box, { width: width as any, height }, style, { opacity }]}
    />
  );
};

const AssessmentSkeleton: React.FC = () => (
  <View style={styles.wrap}>
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <SkeletonBox height={scale(20)} width="60%" />
        <SkeletonBox height={scale(22)} width={scale(90)} style={{ borderRadius: borderRadius.full }} />
      </View>
      <SkeletonBox height={scale(14)} width="45%" />
      <SkeletonBox height={scale(14)} width="55%" />
      <SkeletonBox height={scale(8)} />
      <SkeletonBox height={scale(52)} style={{ borderRadius: borderRadius.lg, marginTop: spacing[1] }} />
    </View>

    <SkeletonBox height={scale(18)} width="35%" style={{ marginTop: spacing[2] }} />

    <View style={styles.catCard}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={styles.catRow}>
          <SkeletonBox
            width={scale(36)}
            height={scale(36)}
            style={{ borderRadius: borderRadius.md, flexShrink: 0 }}
          />
          <SkeletonBox height={scale(14)} style={{ flex: 1 }} />
          <SkeletonBox height={scale(14)} width={scale(70)} />
        </View>
      ))}
    </View>
  </View>
);

export default React.memo(AssessmentSkeleton);

const styles = StyleSheet.create({
  wrap: {
    padding: spacing[4],
    gap: spacing[3],
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    gap: spacing[3],
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  catCard: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    gap: spacing[0],
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  box: {
    backgroundColor: COLORS.gray300,
    borderRadius: borderRadius.sm,
  },
});
