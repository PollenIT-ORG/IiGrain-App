import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../../constants';
import { scale } from '../../../utils';

export const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },

  forgot: {
    alignSelf: 'flex-end',
    marginTop: -spacing[1],
    marginBottom: spacing[5],
  },
  forgotText: {
    ...presets.linkText,
    color: COLORS.primary,
  },

  errorBanner: {
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.danger,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[4],
  },
  errorText: {
    ...presets.bodyXS,
    color: COLORS.danger,
  },

  submit: {
    marginTop: spacing[2],
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[5],
  },
  dividerLine: {
    flex: 1,
    height: borderWidth.thin,
    backgroundColor: COLORS.gray300,
  },
  dividerText: {
    ...presets.labelSM,
    marginHorizontal: spacing[3],
    color: COLORS.gray500,
  },
});
