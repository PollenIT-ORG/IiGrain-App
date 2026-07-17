import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../constants';
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
  helperError: {
    ...presets.bodyXS,
    color: COLORS.danger,
    marginTop: spacing[1],
  },

  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    height: scale(52),
    paddingHorizontal: scale(6),
  },
  containerError: {
    borderColor: COLORS.danger,
    borderWidth: borderWidth.medium,
  },
  containerDisabled: {
    opacity: 0.6,
  },

  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: scale(8),
    height: '100%',
  },
  flag: {
    ...presets.bodyLG,
  },
  caret: {
    ...presets.caption,
    color: COLORS.gray500,
    marginLeft: spacing[1],
  },
  caretLocked: {
    opacity: 0,
    width: 0,
    marginLeft: 0,
  },
  divider: {
    width: borderWidth.thin,
    height: '55%',
    backgroundColor: COLORS.gray300,
    marginHorizontal: spacing[2],
  },
  callingCode: {
    ...presets.inputText,
    color: COLORS.gray900,
  },
  input: {
    ...presets.inputText,
    flex: 1,
    color: COLORS.gray900,
    paddingHorizontal: scale(8),
    height: '100%',
  },
});
