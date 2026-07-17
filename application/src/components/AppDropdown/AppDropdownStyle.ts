import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, spacing, fonts } from '../../constants';
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
  labelError: {
    color: COLORS.danger,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    paddingHorizontal: scale(14),
    height: scale(52),
  },
  fieldError: {
    borderColor: COLORS.danger,
    borderWidth: borderWidth.medium,
  },
  fieldDisabled: {
    opacity: 0.6,
  },

  valueText: {
    ...presets.inputText,
    flex: 1,
    color: COLORS.gray900,
  },
  placeholderText: {
    ...presets.inputText,
    flex: 1,
    color: COLORS.gray500,
  },
  caret: {
    ...presets.bodySM,
    marginLeft: spacing[2],
    color: COLORS.gray500,
  },

  helperError: {
    ...presets.bodyXS,
    color: COLORS.danger,
    marginTop: spacing[1],
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: scale(24),
  },
  sheet: {
    maxHeight: '60%',
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
  },
  sheetTitle: {
    ...presets.labelMD,
    color: COLORS.gray700,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  option: {
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
  },
  optionActive: {
    backgroundColor: COLORS.white,
  },
  optionText: {
    ...presets.bodyMD,
    color: COLORS.gray900,
  },
  optionTextActive: {
    color: COLORS.primary,
    fontFamily: fonts.semibold,
  },
  emptyText: {
    ...presets.bodySM,
    color: COLORS.gray500,
    textAlign: 'center',
    paddingVertical: spacing[5],
  },
});
