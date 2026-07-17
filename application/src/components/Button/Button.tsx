import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { COLORS } from '../../constants';
import AppText from '../AppText/AppText';
import AppGradient from '../AppGradient/AppGradient';
import { styles } from './ButtonStyle';

export type ButtonVariant = 'primary' | 'secondary' | 'outline';
export type ButtonSize = 'lg' | 'sm';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  fullWidth = true,
  leftIcon,
  style,
}) => {
  const isDisabled = disabled || loading;
  const isPrimary  = variant === 'primary';

  const showGradient = isPrimary && !disabled;

  const foregroundColor = variant === 'outline' ? COLORS.primary : COLORS.white;

  return (
    <TouchableOpacity
      activeOpacity={loading ? 1 : 0.82}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        isPrimary ? (disabled ? styles.primaryDisabled : styles.primaryWrapper) : styles[variant],
        fullWidth && styles.fullWidth,
        !isPrimary && disabled && !loading && styles.disabled,
        style,
      ]}>

      {showGradient ? (
        <AppGradient variant="button" style={StyleSheet.absoluteFillObject} />
      ) : null}

      {loading ? (
        <ActivityIndicator size="small" color={foregroundColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={styles.iconWrap}>{leftIcon}</View> : null}
          <AppText
            style={[
              size === 'sm' ? styles.textSM : styles.textLG,
              styles[`${variant}Text`],
            ]}
            numberOfLines={1}>
            {title}
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default Button;
