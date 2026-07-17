import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { TextInput } from 'react-native';
import AppText from '../AppText/AppText';
import AppTextInput from '../AppTextInput/AppTextInput';
import { styles } from './OtpInputStyle';

export interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}

const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  length = 6,
  error = false,
  autoFocus = false,
  onComplete,
}) => {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) {
      onComplete?.(digits);
    }
  };

  const focusInput = () => inputRef.current?.focus();

  return (
    <Pressable style={styles.wrapper} onPress={focusInput}>
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const char = value[i] ?? '';
          const isFilled = char !== '';
          const isActive = focused && i === value.length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                isFilled && styles.boxFilled,
                isActive && styles.boxActive,
                error && styles.boxError,
              ]}>
              <AppText style={styles.boxText}>{char}</AppText>
            </View>
          );
        })}
      </View>

      <AppTextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </Pressable>
  );
};

export default OtpInput;
