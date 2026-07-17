import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppPhoneInput, Button, Input, PasswordStrength } from '../../../components';
import type { PhoneNumberValue } from '../../../components';
import { useFormValidation } from '../../../hooks';
import type { ValidatorMap } from '../../../hooks';
import {
  confirmPasswordValidator,
  emailValidator,
  nameValidator,
  passwordValidator,
  phoneFieldMessage,
} from '../../../utils/fieldValidators';
import type { AuthStackParamList } from '../../../navigation/navigationTypes';
import { styles } from './SignupFormStyle';

type SignupValues = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type Nav = NativeStackNavigationProp<AuthStackParamList>;

const SignupForm: React.FC = () => {
  const navigation = useNavigation<Nav>();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [phoneData, setPhoneData] = useState<PhoneNumberValue | null>(null);

  const validators = useMemo<ValidatorMap<SignupValues>>(
    () => ({
      fullName: nameValidator,
      email: emailValidator,
      password: passwordValidator,
      confirmPassword: confirmPasswordValidator<SignupValues>('password'),
    }),
    [],
  );

  const { errors, validateField, validateForm, setFieldError } =
    useFormValidation<SignupValues>(
      { fullName, phone, email, password, confirmPassword },
      validators,
    );

  const onChangePhoneData = useCallback(
    (data: PhoneNumberValue) => {
      setPhoneData(data);
      if (errors.phone) {
        setFieldError('phone', phoneFieldMessage(data.raw, data.isValid));
      }
    },
    [errors.phone, setFieldError],
  );

  const onChangePassword = useCallback(
    (text: string) => {
      setPassword(text);
      if (errors.password) {
        validateField('password', { password: text });
      }
      if (errors.confirmPassword) {
        validateField('confirmPassword', { password: text });
      }
    },
    [errors.password, errors.confirmPassword, validateField],
  );

  const onChangeConfirm = useCallback(
    (text: string) => {
      setConfirmPassword(text);
      if (errors.confirmPassword) {
        validateField('confirmPassword', { confirmPassword: text });
      }
    },
    [errors.confirmPassword, validateField],
  );

  const handleContinue = useCallback(() => {
    const stringsValid = validateForm();
    const phoneError = phoneFieldMessage(phone, phoneData?.isValid ?? false);
    setFieldError('phone', phoneError);
    if (!stringsValid || phoneError) {
      return;
    }
    navigation.navigate('Role', {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phoneData?.e164 ?? '',
      password,
    });
  }, [validateForm, phone, phoneData, setFieldError, navigation, fullName, email, password]);

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bottomOffset={24}>
      <Input
        label="Full Name*"
       placeholder="Enter your full name"
        value={fullName}
        onChangeText={setFullName}
        onValidate={v => validateField('fullName', { fullName: v })}
        error={errors.fullName}
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
      />

      <AppPhoneInput
        label="Phone Number*"
        placeholder="Enter your mobile number"
        value={phone}
        onChangeText={setPhone}
        onChange={onChangePhoneData}
        error={errors.phone}
        required
      />

      <Input
        label="Email*"
        placeholder="Enter your email address"
        value={email}
        onChangeText={setEmail}
        onValidate={v => validateField('email', { email: v })}
        error={errors.email}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />

      <Input
        label="Password*"
        placeholder="••••••••"
        value={password}
        onChangeText={onChangePassword}
        onBlur={() => validateField('password')}
        error={errors.password}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="password-new"
      />

      <PasswordStrength password={password} />

      <Input
        label="Confirm Password*"
        placeholder="••••••••"
        value={confirmPassword}
        onChangeText={onChangeConfirm}
        onBlur={() => validateField('confirmPassword')}
        error={errors.confirmPassword}
        secureTextEntry
        autoComplete="password-new"
      />

      <Button title="Continue" onPress={handleContinue} style={styles.submit} />
    </KeyboardAwareScrollView>
  );
};

export default React.memo(SignupForm);
