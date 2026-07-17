import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { scale } from '../../utils';
import AppText from '../AppText/AppText';
import AppGradient from '../AppGradient/AppGradient';

export interface AssessmentProgressBarProps {
  progress: number;
  solidColor?: string;
  backgroundColor?: string;
  height?: number;
  showPercent?: boolean;
}

const AssessmentProgressBar: React.FC<AssessmentProgressBarProps> = ({
  progress,
  solidColor,
  backgroundColor = COLORS.gray200,
  height = scale(9),
  showPercent = true,
}) => {
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [animWidth, progress]);

  const widthInterpolated = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.row}>
      <View style={[styles.track, { height, backgroundColor }]}>
        <Animated.View style={{ width: widthInterpolated as any, height }}>
          {solidColor ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: solidColor }]} />
          ) : (
            <AppGradient
              variant="progress"
              style={StyleSheet.absoluteFillObject}
            />
          )}
        </Animated.View>
      </View>

      {showPercent ? (
        <AppText style={styles.percent} color={solidColor ?? COLORS.primary}>
          {progress}%
        </AppText>
      ) : null}
    </View>
  );
};

export default React.memo(AssessmentProgressBar);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  track: {
    flex: 1,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  percent: {
    ...presets.labelMD,
    minWidth: scale(36),
    textAlign: 'right',
  },
});
