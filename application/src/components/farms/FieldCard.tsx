import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, formatNumber, moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import StatusBadge from './StatusBadge';
import { FIELD_HEALTH_META, type Field } from '../../types/farm';

export interface FieldCardProps {
  field: Field;
  onPress: (fieldId: string) => void;
}

const RIPPLE = { color: addAlpha(COLORS.primary, 0.08) };
const CHIP_ICON = moderateScale(13);
const PRESS_SCALE = 0.975;
const PRESS_IN_MS = 90;
const PRESS_OUT_MS = 140;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FieldCard: React.FC<FieldCardProps> = ({ field, onPress }) => {
  const handlePress = useCallback(() => onPress(field.id), [onPress, field.id]);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const animateTo = useCallback(
    (toValue: number, duration: number) => {
      Animated.timing(scaleAnim, {
        toValue,
        duration,
        useNativeDriver: true,
      }).start();
    },
    [scaleAnim],
  );
  const handlePressIn = useCallback(
    () => animateTo(PRESS_SCALE, PRESS_IN_MS),
    [animateTo],
  );
  const handlePressOut = useCallback(() => animateTo(1, PRESS_OUT_MS), [animateTo]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={RIPPLE}
      accessibilityRole="button"
      accessibilityLabel={`${field.name}, ${field.crop}, ${formatNumber(
        field.areaAcres,
      )} acres `}
      accessibilityHint="Opens field details"
      style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.iconTile}>
        <AppIcon name={ICONS.FIELD} size={moderateScale(22)} color={COLORS.primary} />
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <AppText style={styles.name} numberOfLines={1}>
            {field.name}
          </AppText>
        </View>

        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <AppIcon name={ICONS.AREA} size={CHIP_ICON} color={COLORS.primary} />
            <AppText style={styles.chipText}>{formatNumber(field.areaAcres)} ac</AppText>
          </View>
          <View style={styles.chip}>
            <AppIcon name={ICONS.CROP} size={CHIP_ICON} color={COLORS.primary} />
            <AppText style={styles.chipText} numberOfLines={1}>
              {field.crop}
            </AppText>
          </View>
        </View>
      </View>

      <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(20)} color={COLORS.gray500} />
    </AnimatedPressable>
  );
};

export default React.memo(FieldCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3.5],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    marginBottom: spacing[3],
    overflow: 'hidden',
    ...shadows.sm,
  },
  iconTile: {
    width: scale(46),
    height: scale(46),
    borderRadius: borderRadius.xl,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing[2.5],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  name: {
    ...presets.headingXS,
    color: COLORS.gray900,
    flexShrink: 1,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    flexShrink: 1,
    backgroundColor: COLORS.gray100,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
  },
  chipText: {
    ...presets.labelSM,
    color: COLORS.gray700,
    flexShrink: 1,
  },
});
