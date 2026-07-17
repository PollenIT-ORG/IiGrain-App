import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../constants';
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

  backRow: {
    alignSelf: 'center',
    marginTop: spacing[6],
  },
  backText: {
    ...presets.linkText,
    color: COLORS.primary,
  },
});
