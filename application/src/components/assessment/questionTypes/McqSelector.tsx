import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../../AppIcon';
import { COLORS, borderRadius, borderWidth, spacing } from '../../../constants';
import { addAlpha, moderateScale } from '../../../utils';
import AppText from '../../AppText/AppText';
import type { QuestionOption } from '../../../types/assessment';

export interface McqSelectorProps {
  value: string | null;
  options: QuestionOption[];
  onChange: (optionId: string) => void;
  readOnly?: boolean;
}

const McqSelector: React.FC<McqSelectorProps> = ({ value, options, onChange, readOnly = false }) => (
  <View style={styles.list}>
    {options.map(option => {
      const selected = value === option.id;
      const dimmed = readOnly && !selected;
      return (
        <Pressable
          key={option.id}
          onPress={() => onChange(option.id)}
          disabled={readOnly}
          accessibilityRole="radio"
          accessibilityState={{ selected, disabled: readOnly }}
          accessibilityLabel={option.text}
          style={[
            styles.row,
            {
              borderColor: selected ? COLORS.primary : COLORS.gray300,
              borderWidth: selected ? borderWidth.thick : borderWidth.thin,
              backgroundColor: selected ? addAlpha(COLORS.primary, 0.08) : COLORS.white,
            },
            dimmed && styles.rowDimmed,
          ]}>
          <View
            style={[
              styles.radio,
              { borderColor: selected ? COLORS.primary : COLORS.gray500 },
            ]}>
            {selected ? (
              <AppIcon name={ICONS.CHECK} size={moderateScale(12)} color={COLORS.primary} />
            ) : null}
          </View>
          <AppText style={styles.label} color={COLORS.gray900}>
            {option.text}
          </AppText>
        </Pressable>
      );
    })}
  </View>
);

export default React.memo(McqSelector);

const styles = StyleSheet.create({
  list: { gap: spacing[2.5] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3.5],
  },
  rowDimmed: { opacity: 0.45 },
  radio: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
