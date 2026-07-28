import { Dimensions, Platform, StatusBar } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const screenWidth = SCREEN_W;
export const screenHeight = SCREEN_H;

const BASE_WIDTH = 375;

export const scale = (size: number): number => (SCREEN_W / BASE_WIDTH) * size;

export const moderateScale = (size: number, factor: number = 0.5): number =>
  size + (scale(size) - size) * factor;

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export const platformSelect = <T>(options: {
  ios: T;
  android: T;
  default?: T;
}): T => Platform.select(options) as T;

export const iosOnly = <T>(value: T): T | undefined =>
  isIOS ? value : undefined;

export const androidOnly = <T>(value: T): T | undefined =>
  isAndroid ? value : undefined;

export const safeAreaInsets = {
  top: isIOS ? 44 : StatusBar.currentHeight ?? 24,
  bottom: isIOS ? 34 : 0,
  left: 0,
  right: 0,
};

export const topBarHeight = safeAreaInsets.top + 56;

export const isTablet = SCREEN_W >= 768;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * clamp(t, 0, 1);

export const addAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
};

export const lighten = (hex: string, amount: number): string => {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

export const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

export const getInitials = (
  name: string | null | undefined,
  maxLength: number = 2,
): string =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxLength)
    .map(w => w.charAt(0).toUpperCase())
    .join('');

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const formatDate = (iso?: string): string => {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

export const formatNumber = (value: number): string =>
  String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
