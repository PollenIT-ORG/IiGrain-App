import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStatusBar, AppText, AuthHeader, Button, Input } from '../../components';
import { useFormValidation } from '../../hooks';
import type { ValidatorMap } from '../../hooks';
import { confirmPasswordValidator, passwordValidator } from '../../utils/fieldValidators';
import { useAppDispatch } from '../../redux/hooks';
import { clearError, resetPasswordThunk } from '../../redux/slices/authSlice';
import type { AuthScreenProps } from '../../navigation/navigationTypes';
import { styles } from './ResetPasswordScreenStyle';

type ResetValues = {
  password: string;
  confirmPassword: string;
};

const ResetPasswordScreen: React.FC<AuthScreenProps<'ResetPassword'>> = ({
  route,
  navigation,
}) => {
  const { email, code } = route.params;
  const dispatch = useAppDispatch();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (loading || !validateForm()) {
      return;
    }
    setServerError(null);

    setLoading(true);
    const action = await dispatch(
      resetPasswordThunk({ email, code, newPassword: password }),
    );
    setLoading(false);

    if (resetPasswordThunk.fulfilled.match(action)) {
      navigation.reset({ index: 0, routes: [{ name: 'Authentication' }] });
    } else {
      setServerError(action.payload?.message ?? 'Could not reset your password. Please try again.');
    }
  }, [loading, validateForm, dispatch, email, code, password, navigation]);

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
        <AuthHeader
          title="Set a new password"
          subtitle={`Create a new password for\n${email}`}
        />

        <Input
          label="New Password"
          placeholder="••••••••"
          value={password}
          onChangeText={onChangePassword}
          onBlur={() => validateField('password')}
          error={errors.password}
          secureTextEntry
          textContentType="newPassword"
        />

        <Input
          label="Confirm Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={onChangeConfirm}
          onBlur={() => validateField('confirmPassword')}
          error={errors.confirmPassword}
          secureTextEntry
        />

        {serverError ? (
          <View style={styles.errorBanner}>
            <AppText style={styles.errorText}>{serverError}</AppText>
          </View>
        ) : null}

        <Button
          title="Reset Password"
          onPress={handleReset}
          loading={loading}
          style={styles.submit}
        />

        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.navigate('Authentication', { mode: 'login' })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <AppText style={styles.backText}>Back to login</AppText>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
};

export default ResetPasswordScreen;
