import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation } from '@react-navigation/native';
import { AppHeader, AppText, Button, Input, PasswordStrength } from '../../components';
import { useFormValidation } from '../../hooks';
import type { ValidatorMap } from '../../hooks';
import { isStrongPassword } from '../../utils/validators';
import { confirmPasswordValidator, requiredValidator } from '../../utils/fieldValidators';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  changePasswordThunk,
  selectChangingPassword,
} from '../../redux/slices/userSlice';
import { showSuccess } from '../../services/toastService';
import { styles } from './ChangePasswordScreenStyle';

type PasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const changing = useAppSelector(selectChangingPassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const validators = useMemo<ValidatorMap<PasswordValues>>(
    () => ({
      currentPassword: requiredValidator('Current password is required'),
      newPassword: (value, values) => {
        if (!value) {
          return 'New password is required';
        }
        if (!isStrongPassword(value)) {
          return 'Use 8-64 characters with a letter and a number';
        }
        if (value === values.currentPassword) {
          return 'New password must differ from the current one';
        }
        return undefined;
      },
      confirmPassword: confirmPasswordValidator<PasswordValues>('newPassword'),
    }),
    [],
  );

  const { errors, validateField, validateForm } = useFormValidation<PasswordValues>(
    { currentPassword, newPassword, confirmPassword },
    validators,
  );

  const onChangeCurrent = useCallback(
    (text: string) => {
      setCurrentPassword(text);
      if (errors.currentPassword) {
        validateField('currentPassword', { currentPassword: text });
      }
      if (errors.newPassword) {
        validateField('newPassword', { currentPassword: text });
      }
    },
    [errors.currentPassword, errors.newPassword, validateField],
  );

  const onChangeNew = useCallback(
    (text: string) => {
      setNewPassword(text);
      if (errors.newPassword) {
        validateField('newPassword', { newPassword: text });
      }
      if (errors.confirmPassword) {
        validateField('confirmPassword', { newPassword: text });
      }
    },
    [errors.newPassword, errors.confirmPassword, validateField],
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

  const handleSubmit = useCallback(async () => {
    if (changing || !validateForm()) {
      return;
    }
    const action = await dispatch(
      changePasswordThunk({ currentPassword, newPassword }),
    );

    if (changePasswordThunk.fulfilled.match(action)) {
      showSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      navigation.goBack();
    }
  }, [changing, validateForm, dispatch, currentPassword, newPassword, navigation]);

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title="Change Password"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}>
        <AppText style={styles.intro}>
          For your security, enter your current password before choosing a new one.
        </AppText>

        <Input
          label="Current Password*"
          placeholder="••••••••"
          value={currentPassword}
          onChangeText={onChangeCurrent}
          onBlur={() => validateField('currentPassword')}
          error={errors.currentPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
        />

        <Input
          label="New Password*"
          placeholder="••••••••"
          value={newPassword}
          onChangeText={onChangeNew}
          onBlur={() => validateField('newPassword')}
          error={errors.newPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="password-new"
        />

        <PasswordStrength password={newPassword} />

        <Input
          label="Confirm New Password*"
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={onChangeConfirm}
          onBlur={() => validateField('confirmPassword')}
          error={errors.confirmPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="password-new"
        />

        <Button
          title="Update Password"
          onPress={handleSubmit}
          loading={changing}
          style={styles.submit}
        />
      </KeyboardAwareScrollView>
    </View>
  );
};

export default ChangePasswordScreen;
