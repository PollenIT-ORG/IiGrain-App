import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  spacing,
} from '../../constants';
import { scale } from '../../utils';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import { CHECKBOX_TIMING } from './animations';

export interface AnimatedCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}

const BOX = scale(24);

const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  checked,
  onToggle,
  label,
  disabled = false,
}) => {
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, CHECKBOX_TIMING);
  }, [checked, progress]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [COLORS.white, COLORS.primary],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [COLORS.gray300, COLORS.primary],
    ),
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.4, 1]) }],
  }));

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.row, disabled && styles.disabled]}>
      <Animated.View style={[styles.box, boxStyle]}>
        <Animated.View style={tickStyle}>
          <AppIcon name={ICONS.CHECK} size={scale(16)} color={COLORS.white} />
        </Animated.View>
      </Animated.View>
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
};

export default React.memo(AnimatedCheckbox);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  disabled: {
    opacity: 0.6,
  },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: borderRadius.sm,
    borderWidth: borderWidth.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...presets.bodyMD,
    color: COLORS.gray900,
    flex: 1,
  },
});
