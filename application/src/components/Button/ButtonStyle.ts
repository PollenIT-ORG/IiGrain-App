import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, shadows } from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale(52),
    borderRadius: borderRadius.lg,
    paddingHorizontal: scale(20),
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginRight: scale(8),
  },

  primaryWrapper: {
    ...shadows.md,
  },
  primaryDisabled: {
    backgroundColor: COLORS.primary,
    opacity: 0.5,
    ...shadows.sm,
  },

  secondary: {
    backgroundColor: COLORS.secondary,
    ...shadows.sm,
  },
  outline: {
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.medium,
    borderColor: COLORS.primary,
  },
  // Solid red for irreversible actions. Deliberately not a `primary` override:
  // primary paints a gradient over its whole surface, so a custom background
  // passed via `style` would never be visible.
  danger: {
    backgroundColor: COLORS.danger,
    ...shadows.sm,
  },

  textLG: { ...presets.buttonLG },
  textSM: { ...presets.buttonSM },

  primaryText:   { color: COLORS.white },
  secondaryText: { color: COLORS.white },
  outlineText:   { color: COLORS.primary },
  dangerText:    { color: COLORS.white },

  disabled: {
    opacity: 0.5,
  },
});
