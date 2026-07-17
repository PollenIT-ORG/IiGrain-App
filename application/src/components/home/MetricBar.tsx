import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import AppText from '../AppText/AppText';
import { COLORS, borderRadius, presets, spacing, fonts } from '../../constants';

interface MetricBarProps {
  label: string;
  value: number;
  max?: number;
  color: string;
  delay?: number;
}

const MetricBar: React.FC<MetricBarProps> = ({
  label,
  value,
  max = 100,
  color,
  delay = 0,
}) => {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, delay]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.round(pct * 100)}%`],
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <AppText style={styles.label} numberOfLines={1}>
          {label}
        </AppText>
        <AppText style={[styles.value, { color }]}>{value}</AppText>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...presets.bodyXS, color: COLORS.gray700, flex: 1, marginRight: spacing[2] },
  value: { ...presets.labelSM, fontFamily: fonts.semibold },
  track: {
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray200,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: borderRadius.full },
});

export default MetricBar;
