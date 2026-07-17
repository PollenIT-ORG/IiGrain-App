import { moderateScale } from '../../utils';

export const ICON_SIZE = {
  xs: moderateScale(14),
  sm: moderateScale(18),
  md: moderateScale(22),
  lg: moderateScale(26),
  xl: moderateScale(32),
  xxl: moderateScale(40),
} as const;

export type IconSizeToken = keyof typeof ICON_SIZE;

export const ICON_DEFAULTS = {
  size: 'md' as IconSizeToken,
  strokeWidth: 2,
  opacity: 1,
  disabledOpacity: 0.4,
} as const;
