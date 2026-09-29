import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppStatusBar,
  AppText,
  AuthHeader,
  AuthStepBar,
  Button,
  Input,
  PasswordStrength,
} from '../../components';
import { useFormValidation } from '../../hooks';
import type { ValidatorMap } from '../../hooks';
import { confirmPasswordValidator, passwordValidator } from '../../utils/fieldValidators';
import { useAppDispatch } from '../../redux/hooks';
import { clearError, loginThunk, resetPasswordThunk } from '../../redux/slices/authSlice';
import { showSuccess } from '../../services/toastService';
import type { AuthScreenProps } from '../../navigation/navigationTypes';
import { PASSWORD_FLOW_STEPS, passwordFlowCopy } from './passwordFlowCopy';
import { styles } from './ResetPasswordScreenStyle';

type ResetValues = {
  password: string;
  confirmPassword: string;
};

const ResetPasswordScreen: React.FC<AuthScreenProps<'ResetPassword'>> = ({
  route,
  navigation,
}) => {
  const { email, code, purpose = 'reset' } = route.params;
  const copy = useMemo(() => passwordFlowCopy(purpose).password, [purpose]);
  const dispatch = useAppDispatch();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  const validators = useMemo<ValidatorMap<ResetValues>>(
    () => ({
      password: passwordValidator,
      confirmPassword: confirmPasswordValidator<ResetValues>('password'),
    }),
    [],
  );

  const { errors, validateField, validateForm } = useFormValidation<ResetValues>(
    { password, confirmPassword },
    validators,
  );

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

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

  const handleReset = useCallback(async () => {
    if (submitting.current || !validateForm()) {
      return;
    }
    submitting.current = true;
    setServerError(null);
    setLoading(true);

    const chosen = password;
    const action = await dispatch(
      resetPasswordThunk({ email, code, newPassword: chosen }),
    );

    if (!resetPasswordThunk.fulfilled.match(action)) {
      submitting.current = false;
      setLoading(false);
      setServerError(
        action.payload?.presentation.message ??
          'Could not save your password. Please try again.',
      );
      return;
    }

    setPassword('');
    setConfirmPassword('');

    const signIn = await dispatch(loginThunk({ email, password: chosen }));
    submitting.current = false;
    setLoading(false);

    showSuccess(copy.success);

    if (!loginThunk.fulfilled.match(signIn)) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Authentication', params: { mode: 'login' } }],
      });
    }
  }, [validateForm, dispatch, email, code, password, copy.success, navigation]);

  return (
    <View style={styles.safe}>
      <AppStatusBar />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <KeyboardAwareScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={24}>
          <AuthHeader title={copy.title} subtitle={[copy.subtitle, email].join('\n')} />

          <AuthStepBar steps={PASSWORD_FLOW_STEPS} current={3} />

          <Input
            label={copy.label}
            placeholder="Enter a password"
            value={password}
            onChangeText={onChangePassword}
            onBlur={() => validateField('password')}
            error={errors.password}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
          />

          <PasswordStrength password={password} />

          <Input
            label={copy.confirmLabel}
            placeholder="Re-enter the password"
            value={confirmPassword}
            onChangeText={onChangeConfirm}
            onBlur={() => validateField('confirmPassword')}
            error={errors.confirmPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={handleReset}
          />

          {serverError ? (
            <View style={styles.errorBanner}>
              <AppText style={styles.errorText}>{serverError}</AppText>
            </View>
          ) : null}

          <Button
            title={copy.submit}
            onPress={handleReset}
            loading={loading}
            style={styles.submit}
          />

          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.navigate('Authentication', { mode: 'login' })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button">
            <AppText style={styles.backText}>Back to login</AppText>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
};

export default ResetPasswordScreen;
