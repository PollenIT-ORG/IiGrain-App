import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  fontWeights,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';

export const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray300,
    ...shadows.lg,
  },
  row: {
    flexDirection: 'row',
    height: scale(62),
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[0.5],
    minWidth: 0,
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.lg,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  iconBoxActive: {
    backgroundColor: COLORS.lightPrimary,
    borderColor: COLORS.primary,
  },
  spacer: {
    width: scale(72),
  },
  label: {
    ...presets.labelSM,
    textAlign: 'center',
    includeFontPadding: false,
  },
  labelActive: {
    ...presets.labelSM,
    fontSize: moderateScale(13),
    lineHeight: moderateScale(16),
    fontFamily: fonts.semibold,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    includeFontPadding: false,
  },

  fab: {
    position: 'absolute',
    top: -scale(22),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fabLabel: {
    ...presets.caption,
    color: COLORS.primary,
    fontFamily: fonts.semibold,
    marginTop: scale(2),
  },
});
