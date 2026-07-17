import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

const FieldCard: React.FC<FieldCardProps> = ({ field, onPress }) => {
  const handlePress = useCallback(() => onPress(field.id), [onPress, field.id]);
  const healthMeta = FIELD_HEALTH_META[field.status];

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={RIPPLE}
      accessibilityRole="button"
      accessibilityLabel={`${field.name}, ${field.crop}, ${healthMeta.label}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconTile}>
        <AppIcon name={ICONS.FIELD} size={moderateScale(22)} color={COLORS.primary} />
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <AppText style={styles.name} numberOfLines={1}>
            {field.name}
          </AppText>
          <StatusBadge label={healthMeta.label} tone={healthMeta.tone} />
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
    </Pressable>
  );
};

export default React.memo(FieldCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
    marginBottom: spacing[3],
    overflow: 'hidden',
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.96,
    transform: [{ scale: 0.992 }],
  },
  iconTile: {
    width: scale(44),
    height: scale(44),
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing[2],
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
