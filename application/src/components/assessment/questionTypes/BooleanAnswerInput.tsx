import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../../AppIcon';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../../constants';
import { moderateScale, scale } from '../../../utils';
import AppText from '../../AppText/AppText';

export interface BooleanAnswerInputProps {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  readOnly?: boolean;
}

const OPTIONS = [true, false] as const;

const BooleanAnswerInput: React.FC<BooleanAnswerInputProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const pick = (next: boolean): void => onChange(value === next ? null : next);

  return (
    <View style={styles.group}>
      <AppText style={styles.state}>
        {value === null ? 'Not answered' : value ? 'Yes' : 'No'}
      </AppText>
      <View style={styles.row}>
        {OPTIONS.map(option => {
          const selected = value === option;
          return (
            <Pressable
              key={String(option)}
              onPress={() => pick(option)}
              disabled={readOnly}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: readOnly }}
              accessibilityLabel={option ? 'Yes' : 'No'}
              style={[
                styles.pill,
                selected && (option ? styles.pillYes : styles.pillNo),
                readOnly && styles.disabled,
              ]}>
              <AppIcon
                name={option ? ICONS.CHECK : ICONS.CLOSE}
                size={moderateScale(14)}
                color={selected ? COLORS.white : COLORS.gray600}
              />
              <AppText style={[styles.label, selected && styles.labelActive]}>
                {option ? 'Yes' : 'No'}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default React.memo(BooleanAnswerInput);

const styles = StyleSheet.create({
  group: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.white,
    paddingHorizontal: scale(14),
    paddingVertical: spacing[2.5],
  },
  state: { ...presets.bodyXS, color: COLORS.gray500 },
  row: { flexDirection: 'row', gap: spacing[2] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
  },
  pillYes: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillNo: { backgroundColor: COLORS.gray600, borderColor: COLORS.gray600 },
  disabled: { opacity: 0.5 },
  label: { ...presets.labelSM, color: COLORS.gray700 },
  labelActive: { color: COLORS.white },
});
