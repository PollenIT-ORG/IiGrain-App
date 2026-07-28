import { COLORS } from './colors';

export type GradientVariant =
  | 'primary'
  | 'primarySoft'
  | 'primaryDark'
  | 'header'
  | 'button'
  | 'fab'
  | 'progress'
  | 'progressLight'
  | 'success'
  | 'warning'
  | 'infoBlue'
  | 'dark'
  | 'glass'
  | 'cardHighlight'
  | 'emptyState'
  | 'splash'
  | 'badge';

export interface GradientConfig {
  colors: string[];
  start: { x: number; y: number };
  end: { x: number; y: number };
  locations?: number[];
}

const TOP_BOTTOM  = { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } };
const LEFT_RIGHT  = { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
const TL_BR       = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };

export const GRADIENTS: Record<GradientVariant, GradientConfig> = {
  primary: {
    colors: [COLORS.primaryLight, COLORS.primary],
    ...TOP_BOTTOM,
  },

  primarySoft: {
    colors: [COLORS.secondary, COLORS.primary],
    ...TOP_BOTTOM,
  },

  primaryDark: {
    colors: [COLORS.primary, COLORS.primaryDark],
    ...TOP_BOTTOM,
  },

  header: {
    colors: [COLORS.primaryLight, COLORS.primaryDark],
    ...LEFT_RIGHT,
  },

  button: {
    colors: [COLORS.secondary, COLORS.primary],
    ...TL_BR,
  },

  fab: {
    colors: [COLORS.secondary, COLORS.primaryDark],
    ...TL_BR,
  },

  progress: {
    colors: [COLORS.secondary, COLORS.primary],
    ...LEFT_RIGHT,
  },

  success: {
    colors: ['#34C759', COLORS.success],
    ...TOP_BOTTOM,
  },

  warning: {
    colors: ['#FFD60A', COLORS.warning],
    ...TOP_BOTTOM,
  },

  infoBlue: {
    colors: ['#4C97E0', COLORS.infoBlue],
    ...TOP_BOTTOM,
  },

  progressLight: {
    colors: [COLORS.primaryLighter, COLORS.primaryLight],
    ...LEFT_RIGHT,
  },

  dark: {
    colors: [COLORS.gray900, '#1A2030'],
    ...TOP_BOTTOM,
  },

  glass: {
    colors: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)'],
    ...TOP_BOTTOM,
  },

  cardHighlight: {
    colors: [COLORS.secondary, COLORS.primary],
    ...LEFT_RIGHT,
  },

  emptyState: {
    colors: [COLORS.lightPrimary, COLORS.lightPrimaryBg],
    ...TOP_BOTTOM,
  },

  splash: {
    colors: [COLORS.primaryLight, COLORS.primary, COLORS.primaryDark],
    ...TOP_BOTTOM,
    locations: [0, 0.55, 1],
  },

  badge: {
    colors: [COLORS.secondary, COLORS.primary],
    ...LEFT_RIGHT,
  },
};

export const progressGradientForPercent = (percent: number): GradientVariant => {
  const p = Number.isFinite(percent) ? percent : 0;
  if (p <= 40) return 'warning';
  if (p <= 75) return 'infoBlue';
  if (p <= 90) return 'progressLight';
  return 'primaryDark';
};

export const progressColorForPercent = (percent: number): string => {
  const cols = GRADIENTS[progressGradientForPercent(percent)].colors;
  return cols[cols.length - 1];
};

export type ProgressTier = 'poor' | 'fair' | 'good' | 'excellent';

export const progressTierForPercent = (percent: number): ProgressTier => {
  const p = Number.isFinite(percent) ? percent : 0;
  if (p <= 40) return 'poor';
  if (p <= 75) return 'fair';
  if (p <= 90) return 'good';
  return 'excellent';
};

export const PROGRESS_TIER_LABEL: Record<ProgressTier, string> = {
  poor: 'Needs Attention',
  fair: 'Fair Progress',
  good: 'Good Progress',
  excellent: 'Excellent Progress',
};
