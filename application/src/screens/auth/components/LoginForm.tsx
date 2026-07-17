import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText, Button, Input } from '../../../components';
import { useFormValidation } from '../../../hooks';
import type { ValidatorMap } from '../../../hooks';
import { emailValidator, requiredValidator } from '../../../utils/fieldValidators';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  clearError,
  loginThunk,
  requestOtpThunk,
  selectAuthError,
  selectAuthLoading,
} from '../../../redux/slices/authSlice';
import type { AuthStackParamList } from '../../../navigation/navigationTypes';
import { styles } from './LoginFormStyle';

type LoginValues = {
  email: string;
  password: string;
};

type Nav = NativeStackNavigationProp<AuthStackParamList>;

const LoginForm: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const serverError = useAppSelector(selectAuthError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const validators = useMemo<ValidatorMap<LoginValues>>(
    () => ({
      email: emailValidator,
      password: requiredValidator('Password is required'),
    }),
    [],
  );

  const { errors, validateField, validateForm } = useFormValidation<LoginValues>(
    { email, password },
    validators,
  );

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleLogin = useCallback(async () => {
    if (loading || !validateForm()) {
      return;
    }
    const action = await dispatch(loginThunk({ email: email.trim(), password }));
    if (loginThunk.rejected.match(action) && action.payload?.requiresVerification) {
      navigation.navigate('Otp', { email: email.trim(), mode: 'login' });
    }
  }, [loading, validateForm, dispatch, email, password, navigation]);

  const handleOtpLogin = useCallback(async () => {
    if (loading || otpLoading) {
      return;
    }
    if (validateField('email')) {
      return;
    }
    setOtpError(null);
    dispatch(clearError());

    setOtpLoading(true);
    const action = await dispatch(requestOtpThunk(email.trim()));
    setOtpLoading(false);

    if (requestOtpThunk.fulfilled.match(action)) {
      navigation.navigate('Otp', {
        email: email.trim(),
        code: action.payload?.code,
        mode: 'login',
      });
    } else {
      setOtpError(action.payload?.message ?? 'Could not send the code. Please try again.');
    }
  }, [loading, otpLoading, validateField, dispatch, email, navigation]);

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bottomOffset={24}>
      <Input
        label="Email*"
        placeholder="Enter your email address"
        value={email}
        onChangeText={setEmail}
        onValidate={v => validateField('email', { email: v })}
        error={errors.email}
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <Input
        label="Password*"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        onValidate={v => validateField('password', { password: v })}
        error={errors.password}
        secureTextEntry
        textContentType="password"
      />

      <TouchableOpacity
        style={styles.forgot}
        onPress={() => navigation.navigate('ForgotPassword')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <AppText style={styles.forgotText}>Forgot password?</AppText>
      </TouchableOpacity>

      {serverError || otpError ? (
        <View style={styles.errorBanner}>
          <AppText style={styles.errorText}>{serverError ?? otpError}</AppText>
        </View>
      ) : null}

      <Button
        title="Login"
        onPress={handleLogin}
        loading={loading}
        disabled={otpLoading}
        style={styles.submit}
      />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <AppText style={styles.dividerText}>OR</AppText>
        <View style={styles.dividerLine} />
      </View>

      <Button
        title="Login with Email OTP"
        onPress={handleOtpLogin}
        variant="outline"
        loading={otpLoading}
        disabled={loading}
      />
    </KeyboardAwareScrollView>
  );
};

export default React.memo(LoginForm);
