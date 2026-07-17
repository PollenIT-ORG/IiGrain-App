const SHADOW_COLOR = 'rgba(0,0,0,0.08)';

export const shadows = {
  none: {
    shadowColor:   'transparent',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius:  0,
    elevation:     0,
  },
  xs: {
    shadowColor:   SHADOW_COLOR,
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  2,
    elevation:     1,
  },
  sm: {
    shadowColor:   SHADOW_COLOR,
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius:  4,
    elevation:     2,
  },
  md: {
    shadowColor:   SHADOW_COLOR,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius:  8,
    elevation:     4,
  },
  lg: {
    shadowColor:   SHADOW_COLOR,
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius:  16,
    elevation:     8,
  },
  xl: {
    shadowColor:   SHADOW_COLOR,
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius:  24,
    elevation:     12,
  },
  '2xl': {
    shadowColor:   SHADOW_COLOR,
    shadowOffset:  { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius:  40,
    elevation:     20,
  },
} as const;

export type ShadowLevel = keyof typeof shadows;
