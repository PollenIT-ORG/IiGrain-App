import React from 'react';
import { View, ViewStyle } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import { COLORS } from '../../constants';
import AppText from '../AppText/AppText';
import { styles, LOGO_SIZES } from './LogoStyle';

export type LogoSize = 'sm' | 'md' | 'lg';

export interface LogoProps {
  size?: LogoSize;
  iconOnly?: boolean;
  color?: string;
  style?: ViewStyle;
}

const Logo: React.FC<LogoProps> = ({
  size = 'md',
  iconOnly = false,
  color = COLORS.primary,
  style,
}) => {
  const dims = LOGO_SIZES[size];

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.badge,
          {
            width: dims.badge,
            height: dims.badge,
            borderRadius: dims.radius,
            backgroundColor: color,
          },
        ]}
      >
        <AppIcon name={ICONS.BARLEY} size={dims.icon} color={COLORS.white} />
      </View>

      {!iconOnly && (
        <AppText style={[styles.wordmark, { fontSize: dims.font }]}>
          <AppText style={[styles.wordmarkLight, { color: COLORS.secondary }]}>ii</AppText>
          <AppText style={{ color }}>Grain</AppText>
        </AppText>
      )}
    </View>
  );
};

export default Logo;
