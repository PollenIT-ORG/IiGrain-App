import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStatusBar, AppText, AuthHeader, Button, Input } from '../../components';
import { useFormValidation } from '../../hooks';
import type { ValidatorMap } from '../../hooks';
import { emailValidator } from '../../utils/fieldValidators';
import { useAppDispatch } from '../../redux/hooks';
import { clearError, forgotPasswordThunk } from '../../redux/slices/authSlice';
import type { AuthScreenProps } from '../../navigation/navigationTypes';
import { styles } from './ForgotPasswordScreenStyle';

type ForgotValues = {
  email: string;
};

const ForgotPasswordScreen: React.FC<AuthScreenProps<'ForgotPassword'>> = ({ navigation }) => {
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const validators = useMemo<ValidatorMap<ForgotValues>>(
    () => ({ email: emailValidator }),
    [],
  );

  const { errors, validateField, setFieldError } = useFormValidation<ForgotValues>(
    { email },
    validators,
  );

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleSend = useCallback(async () => {
    if (loading || validateField('email')) {
      return;
    }

    setLoading(true);
    const action = await dispatch(forgotPasswordThunk(email.trim()));
    setLoading(false);

    if (forgotPasswordThunk.fulfilled.match(action)) {
      navigation.navigate('Otp', {
        email: email.trim(),
        code: action.payload?.code,
        mode: 'reset',
      });
    } else {
      setFieldError(
        'email',
        action.payload?.message ?? 'Could not send the code. Please try again.',
      );
    }
  }, [loading, validateField, dispatch, email, navigation, setFieldError]);

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
          title="Forgot password"
          subtitle="Enter your email and we'll send a reset code"
        />

        <Input
          label="Email"
         placeholder="Enter your email address"
          value={email}
          onChangeText={setEmail}
          onValidate={v => validateField('email', { email: v })}
          error={errors.email}
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Button
          title="Send Reset Code"
          onPress={handleSend}
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

export default ForgotPasswordScreen;
