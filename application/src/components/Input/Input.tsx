import React, { forwardRef, useState } from 'react';
import {
  KeyboardTypeOptions,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import type { TextInput } from 'react-native';
import { COLORS } from '../../constants';
import AppText from '../AppText/AppText';
import AppTextInput from '../AppTextInput/AppTextInput';
import { styles } from './InputStyle';

export interface InputProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label?: string;
  error?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  onValidate?: (value: string) => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      placeholder,
      secureTextEntry = false,
      keyboardType = 'default',
      onFocus,
      onBlur,
      onChangeText,
      onValidate,
      validateOnChange = false,
      validateOnBlur = true,
      value,
      ...rest
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(secureTextEntry);

    const hasError = !!error;

    const handleFocus: NonNullable<TextInputProps['onFocus']> = e => {
      setFocused(true);
      onFocus?.(e);
    };
    const handleBlur: NonNullable<TextInputProps['onBlur']> = e => {
      setFocused(false);
      onBlur?.(e);
      if (onValidate && validateOnBlur) {
        onValidate(value ?? '');
      }
    };

    const handleChangeText: NonNullable<TextInputProps['onChangeText']> = text => {
      onChangeText?.(text);
      if (onValidate && (validateOnChange || hasError)) {
        onValidate(text);
      }
    };

    return (
      <View style={styles.group}>
        {label ? (
          <AppText
            style={[
              styles.label,
              focused && styles.labelFocused,
              hasError && styles.labelError,
            ]}>
            {label}
          </AppText>
        ) : null}

        <View
          style={[
            styles.field,
            focused && styles.fieldFocused,
            hasError && styles.fieldError,
          ]}>
          <AppTextInput
            ref={ref}
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={COLORS.gray500}
            secureTextEntry={hidden}
            keyboardType={keyboardType}
            autoCapitalize="none"
            autoCorrect={false}
            value={value}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...rest}
          />

          {secureTextEntry ? (
            <TouchableOpacity
              onPress={() => setHidden(h => !h)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button">
              <AppText style={styles.reveal}>{hidden ? 'Show' : 'Hide'}</AppText>
            </TouchableOpacity>
          ) : null}
        </View>

        {hasError ? <AppText style={styles.helperError}>{error}</AppText> : null}
      </View>
    );
  },
);

Input.displayName = 'Input';

export default Input;
