import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
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
import { addAlpha } from '../../utils';
import { AppIcon, ICON_SIZE, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import { PRESS_SCALE, PRESS_TIMING } from './animations';

export interface DangerButtonProps {
  title: string;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const DangerButton: React.FC<DangerButtonProps> = ({
  title,
  onPress,
  icon = ICONS.DELETE,
  disabled = false,
  loading = false,
  style,
}) => {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withTiming(PRESS_SCALE, PRESS_TIMING);
  }, [scale]);

  const onPressOut = useCallback(() => {
    scale.value = withTiming(1, PRESS_TIMING);
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityLabel={title}
        style={[styles.base, isDisabled && styles.disabled]}>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.danger} />
        ) : (
          <View style={styles.content}>
            <AppIcon name={icon} size={ICON_SIZE.sm} color={COLORS.danger} />
            <AppText style={styles.label} numberOfLines={1}>
              {title}
            </AppText>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

export default React.memo(DangerButton);

const styles = StyleSheet.create({
  base: {
    minHeight: spacing[12],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.medium,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
  },
  disabled: {
    borderColor: addAlpha(COLORS.danger, 0.4),
    backgroundColor: addAlpha(COLORS.danger, 0.03),
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  label: {
    ...presets.buttonLG,
    color: COLORS.danger,
  },
});
