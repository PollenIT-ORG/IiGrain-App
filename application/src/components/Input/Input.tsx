import React, { forwardRef, useState } from 'react';
import {
  KeyboardTypeOptions,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import type { TextInput } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import AppText from '../AppText/AppText';
import AppTextInput from '../AppTextInput/AppTextInput';
import { styles } from './InputStyle';

export type InputHintTone = 'muted' | 'success' | 'warning';

const HINT_ICON: Record<InputHintTone, string | null> = {
  muted: null,
  success: ICONS.SUCCESS,
  warning: ICONS.INFO,
};

const HINT_COLOR: Record<InputHintTone, string> = {
  muted: COLORS.gray600,
  success: COLORS.success,
  warning: COLORS.validation,
};

export interface InputProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  hintTone?: InputHintTone;
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
      required = false,
      error,
      hint,
      hintTone = 'muted',
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
      multiline = false,
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
            {required ? <AppText style={styles.required}> *</AppText> : null}
          </AppText>
        ) : null}

        <View
          style={[
            styles.field,
            multiline && styles.fieldMultiline,
            focused && styles.fieldFocused,
            hasError && styles.fieldError,
          ]}>
          <AppTextInput
            ref={ref}
            style={[styles.input, multiline && styles.inputMultiline]}
            placeholder={placeholder}
            placeholderTextColor={COLORS.gray500}
            secureTextEntry={hidden}
            keyboardType={keyboardType}
            autoCapitalize="none"
            autoCorrect={false}
            value={value}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : undefined}
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

        {hasError ? (
          <AppText style={styles.helperError}>{error}</AppText>
        ) : hint ? (
          <View style={styles.hintRow}>
            {HINT_ICON[hintTone] ? (
              <AppIcon
                name={HINT_ICON[hintTone] as string}
                size={moderateScale(13)}
                color={HINT_COLOR[hintTone]}
              />
            ) : null}
            <AppText
              style={[
                styles.hint,
                hintTone === 'success' && styles.hintSuccess,
                hintTone === 'warning' && styles.hintWarning,
              ]}>
              {hint}
            </AppText>
          </View>
        ) : null}
      </View>
    );
  },
);

Input.displayName = 'Input';

export default Input;
