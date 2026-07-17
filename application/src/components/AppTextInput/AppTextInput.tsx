import React, { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { COLORS, fonts } from '../../constants';

export interface AppTextInputProps extends TextInputProps {}

const AppTextInput = forwardRef<TextInput, AppTextInputProps>(
  ({ style, placeholderTextColor, ...rest }, ref) => {
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor ?? COLORS.gray500}
        style={[{ fontFamily: fonts.regular, color: COLORS.gray900 }, style]}
        {...rest}
      />
    );
  },
);

AppTextInput.displayName = 'AppTextInput';

export default AppTextInput;
