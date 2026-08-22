import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  spacing,
} from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  group: {
    width: '100%',
    marginBottom: spacing[4],
  },

  label: {
    ...presets.inputLabel,
    color: COLORS.gray700,
    marginBottom: spacing[1.5],
  },
  labelFocused: {
    color: COLORS.primary,
  },
  labelError: {
    color: COLORS.danger,
  },
  required: {
    color: COLORS.danger,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    paddingHorizontal: scale(14),
    minHeight: scale(52),
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: scale(10),
  },
  fieldFocused: {
    borderColor: COLORS.primary,
    borderWidth: borderWidth.medium,
    backgroundColor: COLORS.white,
  },
  fieldError: {
    borderColor: COLORS.danger,
    borderWidth: borderWidth.medium,
  },

  input: {
    ...presets.inputText,
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    color: COLORS.gray900,
  },
  inputMultiline: {
    height: undefined,
    paddingTop: 0,
    paddingBottom: 0,
  },

  reveal: {
    ...presets.linkText,
    color: COLORS.primary,
    marginLeft: spacing[2],
  },

  helperError: {
    ...presets.bodyXS,
    color: COLORS.danger,
    marginTop: spacing[1],
  },

  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  hint: {
    ...presets.bodyXS,
    flex: 1,
    color: COLORS.gray600,
  },
  hintSuccess: {
    color: COLORS.success,
  },
  hintWarning: {
    color: COLORS.validation,
  },
});
