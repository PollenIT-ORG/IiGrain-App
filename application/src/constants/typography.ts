import { Platform } from 'react-native';

type FontWeight =
  | '100' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

interface FontFamilyConfig {
  light: string;
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  mono: string;
}

type FontSet = 'system' | 'inter';
const ACTIVE_FONT: FontSet = 'inter';

const systemFonts: FontFamilyConfig = Platform.select({
  ios: {
    light:    'System',
    regular:  'System',
    medium:   'System',
    semibold: 'System',
    bold:     'System',
    mono:     'Courier New',
  },
  android: {
    light:    'sans-serif-light',
    regular:  'sans-serif',
    medium:   'sans-serif-medium',
    semibold: 'sans-serif-medium',
    bold:     'sans-serif',
    mono:     'monospace',
  },
  default: {
    light:    'System',
    regular:  'System',
    medium:   'System',
    semibold: 'System',
    bold:     'System',
    mono:     'monospace',
  },
}) as FontFamilyConfig;

const interFonts: FontFamilyConfig = Platform.select({
  ios: {
    light:    'Inter18pt-Regular',
    regular:  'Inter18pt-Regular',
    medium:   'Inter18pt-Medium',
    semibold: 'Inter18pt-SemiBold',
    bold:     'Inter18pt-Bold',
    mono:     'Courier New',
  },
  android: {
    light:    'Inter-Regular',
    regular:  'Inter-Regular',
    medium:   'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold:     'Inter-Bold',
    mono:     'monospace',
  },
  default: {
    light:    'Inter-Regular',
    regular:  'Inter-Regular',
    medium:   'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold:     'Inter-Bold',
    mono:     'monospace',
  },
}) as FontFamilyConfig;

const fontSets: Record<FontSet, FontFamilyConfig> = {
  system: systemFonts,
  inter:  interFonts,
};

export const fonts: FontFamilyConfig = fontSets[ACTIVE_FONT];

export const fontSizes = {
  xs:      10,
  sm:      12,
  md:      14,
  base:    16,
  lg:      18,
  xl:      20,
  '2xl':   24,
  '3xl':   28,
  '4xl':   32,
  '5xl':   40,
  display: 48,
} as const;

export const lineHeights = {
  tight:   1.2,
  snug:    1.35,
  normal:  1.5,
  relaxed: 1.65,
  loose:   1.8,
} as const;

export const lineHeightsPx = {
  xs:      Math.round(fontSizes.xs      * lineHeights.normal),
  sm:      Math.round(fontSizes.sm      * lineHeights.normal),
  md:      Math.round(fontSizes.md      * lineHeights.normal),
  base:    Math.round(fontSizes.base    * lineHeights.normal),
  lg:      Math.round(fontSizes.lg      * lineHeights.normal),
  xl:      Math.round(fontSizes.xl      * lineHeights.normal),
  '2xl':   Math.round(fontSizes['2xl']  * lineHeights.snug),
  '3xl':   Math.round(fontSizes['3xl']  * lineHeights.snug),
  '4xl':   Math.round(fontSizes['4xl']  * lineHeights.tight),
  '5xl':   Math.round(fontSizes['5xl']  * lineHeights.tight),
  display: Math.round(fontSizes.display * lineHeights.tight),
} as const;

export const fontWeights = {
  thin:      '100',
  light:     '300',
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
  black:     '900',
} as const;

export const letterSpacings = {
  tightest: -0.8,
  tighter:  -0.4,
  tight:    -0.2,
  normal:    0,
  wide:      0.4,
  wider:     0.8,
  widest:    1.6,
} as const;

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: FontWeight;
  lineHeight: number;
  letterSpacing?: number;
}

export const presets = {
  displayLarge: {
    fontFamily:    fonts.bold,
    fontSize:      fontSizes.display,
    fontWeight:    fontWeights.bold,
    lineHeight:    lineHeightsPx.display,
    letterSpacing: letterSpacings.tighter,
  },
  displayMedium: {
    fontFamily:    fonts.bold,
    fontSize:      fontSizes['5xl'],
    fontWeight:    fontWeights.bold,
    lineHeight:    lineHeightsPx['5xl'],
    letterSpacing: letterSpacings.tighter,
  },
  displaySmall: {
    fontFamily:    fonts.semibold,
    fontSize:      fontSizes['4xl'],
    fontWeight:    fontWeights.semibold,
    lineHeight:    lineHeightsPx['4xl'],
    letterSpacing: letterSpacings.tight,
  },

  headingXL: {
    fontFamily:    fonts.bold,
    fontSize:      fontSizes['3xl'],
    fontWeight:    fontWeights.bold,
    lineHeight:    lineHeightsPx['3xl'],
    letterSpacing: letterSpacings.tight,
  },
  headingLG: {
    fontFamily:    fonts.semibold,
    fontSize:      fontSizes['2xl'],
    fontWeight:    fontWeights.semibold,
    lineHeight:    lineHeightsPx['2xl'],
    letterSpacing: letterSpacings.tight,
  },
  headingMD: {
    fontFamily:    fonts.semibold,
    fontSize:      fontSizes.xl,
    fontWeight:    fontWeights.semibold,
    lineHeight:    lineHeightsPx.xl,
    letterSpacing: letterSpacings.normal,
  },
  headingSM: {
    fontFamily:    fonts.medium,
    fontSize:      fontSizes.lg,
    fontWeight:    fontWeights.medium,
    lineHeight:    lineHeightsPx.lg,
    letterSpacing: letterSpacings.normal,
  },
  headingXS: {
    fontFamily:    fonts.medium,
    fontSize:      fontSizes.base,
    fontWeight:    fontWeights.medium,
    lineHeight:    lineHeightsPx.base,
    letterSpacing: letterSpacings.normal,
  },

  bodyLG: {
    fontFamily:  fonts.regular,
    fontSize:    fontSizes.lg,
    fontWeight:  fontWeights.regular,
    lineHeight:  lineHeightsPx.lg,
  },
  bodyMD: {
    fontFamily:  fonts.regular,
    fontSize:    fontSizes.base,
    fontWeight:  fontWeights.regular,
    lineHeight:  lineHeightsPx.base,
  },
  bodySM: {
    fontFamily:  fonts.regular,
    fontSize:    fontSizes.md,
    fontWeight:  fontWeights.regular,
    lineHeight:  lineHeightsPx.md,
  },
  bodyXS: {
    fontFamily:  fonts.regular,
    fontSize:    fontSizes.sm,
    fontWeight:  fontWeights.regular,
    lineHeight:  lineHeightsPx.sm,
  },

  labelLG: {
    fontFamily:    fonts.medium,
    fontSize:      fontSizes.base,
    fontWeight:    fontWeights.medium,
    lineHeight:    lineHeightsPx.base,
    letterSpacing: letterSpacings.wide,
  },
  labelMD: {
    fontFamily:    fonts.medium,
    fontSize:      fontSizes.md,
    fontWeight:    fontWeights.medium,
    lineHeight:    lineHeightsPx.md,
    letterSpacing: letterSpacings.wide,
  },
  labelSM: {
    fontFamily:    fonts.medium,
    fontSize:      fontSizes.sm,
    fontWeight:    fontWeights.medium,
    lineHeight:    lineHeightsPx.sm,
    letterSpacing: letterSpacings.wide,
  },

  buttonLG: {
    fontFamily:    fonts.semibold,
    fontSize:      fontSizes.base,
    fontWeight:    fontWeights.semibold,
    lineHeight:    lineHeightsPx.base,
    letterSpacing: letterSpacings.wide,
  },
  buttonSM: {
    fontFamily:    fonts.semibold,
    fontSize:      fontSizes.md,
    fontWeight:    fontWeights.semibold,
    lineHeight:    lineHeightsPx.md,
    letterSpacing: letterSpacings.wide,
  },

  inputLabel: {
    fontFamily:    fonts.medium,
    fontSize:      fontSizes.md,
    fontWeight:    fontWeights.medium,
    lineHeight:    lineHeightsPx.md,
    letterSpacing: letterSpacings.normal,
  },
  inputText: {
    fontFamily:  fonts.regular,
    fontSize:    fontSizes.base,
    fontWeight:  fontWeights.regular,
    lineHeight:  lineHeightsPx.base,
  },

  linkText: {
    fontFamily:    fonts.medium,
    fontSize:      fontSizes.md,
    fontWeight:    fontWeights.medium,
    lineHeight:    lineHeightsPx.md,
    letterSpacing: letterSpacings.normal,
  },

  caption: {
    fontFamily:    fonts.regular,
    fontSize:      fontSizes.xs,
    fontWeight:    fontWeights.regular,
    lineHeight:    lineHeightsPx.xs,
    letterSpacing: letterSpacings.normal,
  },
  overline: {
    fontFamily:    fonts.medium,
    fontSize:      fontSizes.xs,
    fontWeight:    fontWeights.medium,
    lineHeight:    lineHeightsPx.xs,
    letterSpacing: letterSpacings.widest,
  },
  code: {
    fontFamily:    fonts.mono,
    fontSize:      fontSizes.sm,
    fontWeight:    fontWeights.regular,
    lineHeight:    lineHeightsPx.sm,
    letterSpacing: letterSpacings.tight,
  },
} satisfies Record<string, TextStyle>;

export const typography = {
  fonts,
  fontSizes,
  lineHeights,
  lineHeightsPx,
  fontWeights,
  letterSpacings,
  presets,
} as const;
