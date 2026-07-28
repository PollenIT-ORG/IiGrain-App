export const COLORS = {
  primary: '#167A45',
  primaryDark: '#0F5E33',
  primaryLight: '#3FAE72',
  primaryLighter: '#7DD8A5',
  primaryLighterA: 'rgba(125, 216, 165, 0.1)',

  secondary: '#27B36E',
  accent: '#F6B43C',
  infoBlue: '#136ACB',

  emerald: '#34C97B',
  leaf: '#63D48C',

  info: '#2E8B57',
  success: '#2FBF71',
  warning: '#F4B740',
  danger: '#E5484D',
  // Distinct from `warning` amber so a validation prompt never reads as a
  // system warning, and never as the green success colour.
  validation: '#E36414',

  gray900: '#212939',
  gray700: '#4F5B66',
  gray600: '#707A84',
  gray500: '#ADB5BD',
  gray300: '#cdd1d4',
  gray200: '#dde0e3',
  gray100: '#F8F9FA',

  lightPrimary: '#E8F8EF',
  lightPrimaryBg: '#F3FCF7',

  surface:    '#F0F6F2',
  card:       '#FFFFFF',
  glass:      'rgba(255,255,255,0.12)',
  overlay:    'rgba(0,0,0,0.45)',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export type AppColors = typeof COLORS;