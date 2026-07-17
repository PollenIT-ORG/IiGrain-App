import React, { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { formatNumber, scale } from '../../utils';
import { AppText } from '..';
import type { Field } from '../../types/farm';

interface FieldChipsProps {
  fields: Field[];
  selectedId: string;
  onSelect: (fieldId: string) => void;
  palette?: string[];
}

const DEFAULT_PALETTE = [
  COLORS.accent,
  COLORS.info,
  COLORS.secondary,
  COLORS.primary,
];

const FieldChips = memo(
  ({ fields, selectedId, onSelect, palette = DEFAULT_PALETTE }: FieldChipsProps) => {
    if (fields.length === 0) return null;

    return (
      <View style={styles.container}>
        {fields.map((field, index) => {
          const isSelected = field.id === selectedId;
          const color = palette[index % palette.length];

          return (
            <Pressable
              key={field.id}
              onPress={() => onSelect(field.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${field.name}, ${formatNumber(field.areaAcres)} acres`}
              hitSlop={styles.hitSlop}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                isSelected && { borderColor: color },
                pressed && styles.chipPressed,
              ]}>
              <View style={[styles.indexWrap, { backgroundColor: isSelected ? color : COLORS.white }]}>
                <AppText style={[styles.indexText, { color: isSelected ? COLORS.white : color }]}>
                  {index + 1}
                </AppText>
              </View>
              <View style={styles.textContainer}>
                <AppText style={styles.name} numberOfLines={2}>
                  {field.name}
                </AppText>
                <AppText style={styles.acres}>
                  {formatNumber(field.areaAcres)} ac
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  },
);

FieldChips.displayName = 'FieldChips';

export { FieldChips };
export default FieldChips;

const styles = StyleSheet.create({
  hitSlop: {
    top: spacing[1],
    right: spacing[1],
    bottom: spacing[1],
    left: spacing[1],
  },
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    gap: spacing[1.5],
  },
  chip: {
    width: '23%',
    minHeight: scale(92),
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[1.5],
    ...shadows.sm,
  },
  chipSelected: {
    borderWidth: borderWidth.medium,
  },
  chipPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  indexWrap: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    ...presets.labelSM,
  },
  textContainer: {
    alignItems: 'center',
    gap: spacing[0.5],
  },
  name: {
    ...presets.labelSM,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  acres: {
    ...presets.bodyXS,
    color: COLORS.gray700,
    textAlign: 'center',
  },
});
