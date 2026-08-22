import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import AppText from '../../components/AppText/AppText';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  shadows,
  spacing,
} from '../../constants';
import type { MapKind } from '../types';

export interface MapKindOption {
  readonly value: MapKind;
  readonly label: string;
}

export const MAP_KIND_OPTIONS: readonly MapKindOption[] = [
  { value: 'satellite', label: 'Satellite' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'standard', label: 'Map' },
];

export interface MapKindSwitchProps {
  value: MapKind;
  onChange: (kind: MapKind) => void;
  options?: readonly MapKindOption[];
  style?: StyleProp<ViewStyle>;
}

const MapKindSwitch: React.FC<MapKindSwitchProps> = ({
  value,
  onChange,
  options = MAP_KIND_OPTIONS,
  style,
}) => (
  <View style={[styles.wrap, style]}>
    {options.map(option => {
      const active = option.value === value;
      return (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          accessibilityLabel={`${option.label} view`}
          style={[styles.option, active && styles.optionActive]}>
          <AppText style={[styles.label, active && styles.labelActive]}>
            {option.label}
          </AppText>
        </Pressable>
      );
    })}
  </View>
);

export default React.memo(MapKindSwitch);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
    ...shadows.md,
  },
  option: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  optionActive: { backgroundColor: COLORS.primary },
  label: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.gray700 },
  labelActive: { color: COLORS.white },
});
