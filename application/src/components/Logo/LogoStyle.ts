import { StyleSheet } from 'react-native';
import { fonts, letterSpacings, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';

export const LOGO_SIZES = {
  sm: { badge: scale(32), radius: scale(8), icon: scale(20), font: moderateScale(18) },
  md: { badge: scale(44), radius: scale(12), icon: scale(28), font: moderateScale(26) },
  lg: { badge: scale(60), radius: scale(16), icon: scale(38), font: moderateScale(34) },
} as const;

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[2.5],

  },
  wordmark: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    letterSpacing: letterSpacings.tight,
  },
  wordmarkLight: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
  },
});
