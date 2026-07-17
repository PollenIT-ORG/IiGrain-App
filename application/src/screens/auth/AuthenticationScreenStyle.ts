import { StyleSheet } from 'react-native';
import { COLORS, presets, spacing } from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  top: {
    paddingHorizontal: scale(24),
    paddingTop: spacing[6],
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(24),
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  footerPrompt: {
    ...presets.bodySM,
    color: COLORS.gray700,
  },
  footerAction: {
    ...presets.linkText,
    color: COLORS.primary,
  },
});
