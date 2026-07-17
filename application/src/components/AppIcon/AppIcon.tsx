import React, { useMemo } from 'react';
import type { TextStyle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../constants';
import { ICONS } from './iconRegistry';
import { ICON_DEFAULTS, ICON_SIZE } from './constants';
import type { AppIconProps } from './types';

const isRegistryKey = (n: string): n is keyof typeof ICONS =>
  Object.prototype.hasOwnProperty.call(ICONS, n);

const resolveGlyph = (name: string, filled: boolean): string => {
  const base = isRegistryKey(name) ? ICONS[name] : name;
  return filled ? base.replace(/-outline$/, '') : base;
};

const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = ICON_DEFAULTS.size,
  color = COLORS.gray900,
  filled = false,
  disabled = false,
  opacity,
  rotation,
  style,
  testID,
  accessibilityLabel,
  accessibilityRole = 'image',
}) => {
  const glyph = useMemo(() => resolveGlyph(name, filled), [name, filled]);

  const resolvedSize = typeof size === 'number' ? size : ICON_SIZE[size];
  const resolvedOpacity = disabled
    ? ICON_DEFAULTS.disabledOpacity
    : opacity ?? ICON_DEFAULTS.opacity;

  const composedStyle = useMemo(() => {
    const parts: TextStyle[] = [];
    if (resolvedOpacity !== 1) {
      parts.push({ opacity: resolvedOpacity });
    }
    if (rotation) {
      parts.push({ transform: [{ rotate: `${rotation}deg` }] });
    }
    if (style) {
      return [...parts, style];
    }
    return parts.length ? parts : undefined;
  }, [resolvedOpacity, rotation, style]);

  return (
    <MaterialCommunityIcons
      name={glyph}
      size={resolvedSize}
      color={color}
      style={composedStyle}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessible={!!accessibilityLabel}
    />
  );
};

export default React.memo(AppIcon);
