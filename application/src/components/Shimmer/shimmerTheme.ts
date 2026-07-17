import { Easing, type EasingFunction } from 'react-native-reanimated';
import { COLORS, borderRadius, spacing } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';

export const SHIMMER_BASE_COLOR = addAlpha(COLORS.primaryLighter, 0.22);

export const SHIMMER_HIGHLIGHT_COLORS: string[] = [
  'transparent',
  addAlpha(COLORS.lightPrimary, 0.55),
  addAlpha(COLORS.white, 0.55),
  addAlpha(COLORS.lightPrimary, 0.55),
  'transparent',
];

export const SHIMMER_DURATION = 1500;
export const SHIMMER_SPEED = 1;
export const SHIMMER_EASING: EasingFunction = Easing.linear;

export const SHIMMER_GRADIENT_START = { x: 0, y: 0 };
export const SHIMMER_GRADIENT_END = { x: 1, y: 1 };

export const SHIMMER_GRADIENT_CONFIG = {
  colors: SHIMMER_HIGHLIGHT_COLORS,
  start: SHIMMER_GRADIENT_START,
  end: SHIMMER_GRADIENT_END,
};

export const SHIMMER_RADIUS = {
  xs: borderRadius.xs,
  sm: borderRadius.sm,
  md: borderRadius.md,
  lg: borderRadius.lg,
  xl: borderRadius.xl,
  pill: borderRadius.full,
} as const;

export const SHIMMER_LINE_HEIGHT = moderateScale(12);
export const SHIMMER_LINE_GAP = spacing[2];

export const SHIMMER_ITEM_GAP = spacing[3];

export const SHIMMER_SIZES = {
  avatar: scale(48),
  circle: scale(40),
  buttonHeight: scale(48),
  inputHeight: scale(48),
  chipWidth: scale(72),
  chipHeight: scale(28),
  imageHeight: scale(160),
  iconTile: scale(44),
} as const;
