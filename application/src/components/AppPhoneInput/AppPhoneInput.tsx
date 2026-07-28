import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import PhoneInput, {
  getCountryByCca2,
  type ICountry,
} from 'react-native-international-phone-number';
import {
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  type CountryCode,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import { COLORS } from '../../constants';
import AppText from '../AppText/AppText';
import { styles } from './AppPhoneInputStyle';

const DEFAULT_COUNTRY = 'US';

const resolveCountry = (iso: string): ICountry | null =>
  getCountryByCca2(iso) ?? getCountryByCca2(DEFAULT_COUNTRY) ?? null;

const maxDigitsFor = (iso?: string): number | null => {
  if (!iso) {
    return null;
  }
  try {
    const example = getExampleNumber(iso as CountryCode, examples);
    return example ? example.nationalNumber.length : null;
  } catch {
    return null;
  }
};

export interface PhoneNumberValue {
  raw: string;
  dialCode: string;
  e164: string;
  countryCode: string;
  isValid: boolean;
}

export interface AppPhoneInputProps {
  value: string;
  onChangeText: (value: string) => void;
  onChange?: (data: PhoneNumberValue) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  defaultCountry?: string;
  countryLocked?: boolean;
}

const buildValue = (
  national: string,
  country: ICountry | null,
  fallbackIso: string,
): PhoneNumberValue => {
  const iso = (country?.cca2 ?? fallbackIso) as CountryCode;
  const digits = national.replace(/\D/g, '');
  let dialCode = '';
  let e164 = '';
  let valid = false;
  try {
    dialCode = `+${getCountryCallingCode(iso)}`;
    e164 = digits ? `${dialCode}${digits}` : '';
    valid = e164 ? isValidPhoneNumber(e164) : false;
  } catch {
  }
  return { raw: digits, dialCode, e164, countryCode: iso, isValid: valid };
};

const AppPhoneInput: React.FC<AppPhoneInputProps> = ({
  value,
  onChangeText,
  onChange,
  error,
  label,
  placeholder,
  disabled = false,
  required = false,
  defaultCountry = DEFAULT_COUNTRY,
  countryLocked = false,
}) => {
  const [country, setCountry] = useState<ICountry | null>(() =>
    resolveCountry(defaultCountry),
  );

  useEffect(() => {
    setCountry(prev =>
      prev?.cca2 === defaultCountry ? prev : resolveCountry(defaultCountry),
    );
  }, [defaultCountry]);

  const hasError = !!error;

  const maxDigits = useMemo(
    () => maxDigitsFor(country?.cca2 ?? defaultCountry),
    [country, defaultCountry],
  );

  const phoneInputStyles = useMemo(
    () => ({
      container: [
        styles.container,
        hasError && styles.containerError,
        disabled && styles.containerDisabled,
      ],
      flagContainer: styles.flagContainer,
      flag: styles.flag,
      caret: countryLocked ? styles.caretLocked : styles.caret,
      divider: styles.divider,
      callingCode: styles.callingCode,
      input: styles.input,
    }),
    [hasError, disabled, countryLocked],
  );

  const handlePhoneChange = (national: string) => {
    let next = national;
    if (maxDigits) {
      const digits = national.replace(/\D/g, '');
      if (digits.length > maxDigits) {
        next = digits.slice(0, maxDigits);
      }
    }
    onChangeText(next);
    onChange?.(buildValue(next, country, defaultCountry));
  };

  const handleCountryChange = (next: ICountry) => {
    if (countryLocked) {
      return;
    }
    setCountry(next);
    onChangeText('');
    onChange?.(buildValue('', next, defaultCountry));
  };

  return (
    <View style={styles.group}>
      {label ? (
        <AppText style={[styles.label, hasError && styles.labelError]}>
          {label}
          {required ? ' *' : ''}
        </AppText>
      ) : null}

      <PhoneInput
        value={value}
        defaultCountry={(country?.cca2 ?? defaultCountry) as ICountry['cca2']}
        onChangePhoneNumber={handlePhoneChange}
        selectedCountry={country}
        onChangeSelectedCountry={handleCountryChange}
        disabled={disabled}
        modalDisabled={disabled || countryLocked}
        placeholder={placeholder ?? 'Phone number'}
        phoneInputPlaceholderTextColor={COLORS.gray500}
        phoneInputStyles={phoneInputStyles}
        autoComplete="tel"
        textContentType="telephoneNumber"
        importantForAutofill="yesExcludeDescendants"
      />

      {hasError ? <AppText style={styles.helperError}>{error}</AppText> : null}
    </View>
  );
};

export default AppPhoneInput;
