import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, borderRadius, presets, spacing, fonts } from '../../constants';
import { clamp } from '../../utils';
import AppText from '../AppText/AppText';

export interface ReportScoreBarProps {
  label: string;
  value: number | null;
  color: string;
  max?: number;
  delay?: number;
}

const ReportScoreBar: React.FC<ReportScoreBarProps> = ({
  label,
  value,
  color,
  max = 100,
  delay = 0,
}) => {
  const hasScore = value !== null;
  const pct = hasScore && max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(pct, { duration: 900 }));
  }, [pct, delay, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View style={styles.row}>
      <AppText style={styles.label} numberOfLines={2}>
        {label}
      </AppText>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
      </View>
      <AppText style={[styles.value, hasScore ? { color } : styles.valueEmpty]}>
        {hasScore ? value : '—'}
      </AppText>
    </View>
  );
};

export default React.memo(ReportScoreBar);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2.5],
  },
  label: {
    ...presets.bodySM,
    color: COLORS.gray900,
    width: '38%',
  },
  track: {
    flex: 1,
    height: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray200,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  valueEmpty: {
    color: COLORS.gray500,
  },
  value: {
    ...presets.headingXS,
    fontFamily: fonts.semibold,
    width: spacing[8],
    textAlign: 'right',
  },
});
