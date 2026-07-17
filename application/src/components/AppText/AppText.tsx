import React from 'react';
import { Text as RNText, TextProps, TextStyle } from 'react-native';
import { COLORS, fonts, presets } from '../../constants';

export type TextVariant = keyof typeof presets;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

const AppText: React.FC<AppTextProps> = ({
  variant,
  color = COLORS.gray900,
  align,
  style,
  ...rest
}) => {
  return (
    <RNText
      style={[
        { fontFamily: fonts.regular, color },
        variant ? presets[variant] : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
};

export default AppText;
