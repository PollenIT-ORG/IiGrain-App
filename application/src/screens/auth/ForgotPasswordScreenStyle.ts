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

  notice: {
    marginBottom: spacing[5],
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
