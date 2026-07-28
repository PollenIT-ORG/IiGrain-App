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
  // Red `*` marking a mandatory field; stays red regardless of focus/error so
  // the requirement reads at a glance.
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
    // minHeight (not height): single-line inputs still sit at 52, but a
    // multiline field can grow to wrap a long value instead of overflowing it.
    minHeight: scale(52),
  },
  // Multiline (e.g. a full address): let the box grow, and align its content to
  // the top with real vertical padding since it no longer centres one line.
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
  // Drop the fixed 100% height so the input can grow with its wrapped lines.
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
});
