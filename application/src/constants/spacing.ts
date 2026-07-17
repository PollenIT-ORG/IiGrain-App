export const spacing = {
  0:    0,
  px:   1,
  0.5:  2,
  1:    4,
  1.5:  6,
  2:    8,
  2.5:  10,
  3:    12,
  3.5:  14,
  4:    16,
  5:    20,
  6:    24,
  7:    28,
  8:    32,
  9:    36,
  10:   40,
  11:   44,
  12:   48,
  14:   56,
  16:   64,
  20:   80,
  24:   96,
  28:   112,
  32:   128,
} as const;

export const borderRadius = {
  none: 0,
  xs:   2,
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const borderWidth = {
  none:     0,
  hairline: 0.5,
  thin:     1,
  medium:   1.5,
  thick:    2,
  heavy:    3,
} as const;

export const layout = {
  screenPadding: 16,
  sectionGap:    24,
  cardPadding:   16,
  headerHeight:  56,
} as const;

export const zIndex = {
  base:    0,
  overlay: 300,
  modal:   400,
} as const;
