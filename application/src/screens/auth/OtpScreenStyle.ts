import { StyleSheet } from 'react-native';
import { COLORS, presets, spacing } from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: scale(24),
    paddingVertical: spacing[8],
  },

  errorInline: {
    ...presets.bodyXS,
    color: COLORS.danger,
    textAlign: 'center',
    marginTop: spacing[3],
  },

  expiry: {
    ...presets.buttonSM,
    textAlign: 'center',
    color: COLORS.gray700,
    marginBottom: spacing[4],
  },
  expiryExpired: {
    color: COLORS.danger,
  },

  submit: {
    marginTop: spacing[2],
  },

  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[6],
  },
  resendPrompt: {
    ...presets.bodySM,
    color: COLORS.gray700,
  },
  resendAction: {
    ...presets.linkText,
    color: COLORS.primary,
  },
  resendDisabled: {
    color: COLORS.gray500,
  },

  backRow: {
    alignSelf: 'center',
    marginTop: spacing[5],
  },
  backText: {
    ...presets.linkText,
    color: COLORS.gray500,
  },
});
