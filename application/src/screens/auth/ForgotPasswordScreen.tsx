import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  NoticeCard,
} from '../../components';
import { useFormValidation } from '../../hooks';
import type { ValidatorMap } from '../../hooks';
import { emailValidator } from '../../utils/fieldValidators';
import { useAppDispatch } from '../../redux/hooks';
import { clearError, forgotPasswordThunk } from '../../redux/slices/authSlice';
import type { AuthScreenProps } from '../../navigation/navigationTypes';
import { PASSWORD_FLOW_STEPS, passwordFlowCopy } from './passwordFlowCopy';
import { styles } from './ForgotPasswordScreenStyle';

type ForgotValues = {
  email: string;
};

const ForgotPasswordScreen: React.FC<AuthScreenProps<'ForgotPassword'>> = ({
  route,
  navigation,
}) => {
  const purpose = route.params?.purpose ?? 'reset';
  const copy = useMemo(() => passwordFlowCopy(purpose), [purpose]);
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState(route.params?.email ?? '');
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
        purpose,
      });
    } else {
      setFieldError(
        'email',
        action.payload?.message ?? 'Could not send the code. Please try again.',
      );
    }
  }, [loading, validateField, dispatch, email, navigation, purpose, setFieldError]);

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
            title={copy.request.title}
            subtitle={copy.request.subtitle}
          />

          <AuthStepBar steps={PASSWORD_FLOW_STEPS} current={1} />

          {copy.notice ? (
            <NoticeCard
              icon={copy.notice.icon}
              title={copy.notice.title}
              message={copy.notice.message}
              style={styles.notice}
            />
          ) : null}

          <Input
            label={copy.request.emailLabel}
            placeholder="Enter your email address"
            value={email}
            onChangeText={setEmail}
            onValidate={v => validateField('email', { email: v })}
            error={errors.email}
            hint={copy.request.emailHint}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />

          <Button
            title={copy.request.submit}
            onPress={handleSend}
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

export default ForgotPasswordScreen;
