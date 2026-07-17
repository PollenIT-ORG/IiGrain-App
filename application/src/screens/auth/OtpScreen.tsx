import React, { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStatusBar, AppText, AuthHeader, Button, OtpInput } from '../../components';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  clearError,
  forgotPasswordThunk,
  requestOtpThunk,
  selectAuthError,
  selectAuthLoading,
  verifyEmailForSignupThunk,
  verifyOtpThunk,
} from '../../redux/slices/authSlice';
import { showSuccess } from '../../services/toastService';
import type { AuthScreenProps } from '../../navigation/navigationTypes';
import { styles } from './OtpScreenStyle';

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 10 * 60;

type OtpMode = 'verify' | 'login' | 'reset';

const OTP_COPY: Record<
  OtpMode,
  {
    title: string;
    intro: string;
    submit: string;
    backLabel: string;
    backTarget: 'login' | 'signup';
  }
> = {
  verify: {
    title: 'Verify your email',
    intro: 'Enter the 6-digit code we sent to',
    submit: 'Verify',
    backLabel: 'Back to sign up',
    backTarget: 'signup',
  },
  login: {
    title: 'Sign in with OTP',
    intro: 'Enter the 6-digit code we sent to',
    submit: 'Sign In',
    backLabel: 'Back to login',
    backTarget: 'login',
  },
  reset: {
    title: 'Reset your password',
    intro: 'Enter the 6-digit code we sent to reset the password for',
    submit: 'Continue',
    backLabel: 'Back to login',
    backTarget: 'login',
  },
};

const formatMmSs = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const OtpScreen: React.FC<AuthScreenProps<'Otp'>> = ({ route, navigation }) => {
  const { email, code: prefillCode, mode = 'verify' } = route.params;
  const copy = OTP_COPY[mode];
  const isReset = mode === 'reset';
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const serverError = useAppSelector(selectAuthError);

  const [code, setCode] = useState(prefillCode ?? '');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [expiresIn, setExpiresIn] = useState(OTP_EXPIRY_SECONDS);

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  useEffect(() => {
    if (expiresIn <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setExpiresIn(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresIn]);

  const submitCode = useCallback(
    async (otp: string) => {
      if (loading) {
        return;
      }
      setCodeError(undefined);
      if (isReset) {
        navigation.navigate('ResetPassword', { email, code: otp });
        return;
      }
      if (mode === 'verify') {
        const action = await dispatch(verifyEmailForSignupThunk({ email, code: otp }));
        if (verifyEmailForSignupThunk.fulfilled.match(action)) {
          showSuccess('Email verified! Please log in.');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Authentication', params: { mode: 'login' } }],
          });
        }
        return;
      }
      dispatch(verifyOtpThunk({ email, code: otp }));
    },
    [loading, isReset, mode, navigation, dispatch, email],
  );

  const handleChange = useCallback(
    (next: string) => {
      setCode(next);
      if (codeError) {
        setCodeError(undefined);
      }
    },
    [codeError],
  );

  const handleVerify = useCallback(() => {
    if (code.length !== OTP_LENGTH) {
      setCodeError(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    submitCode(code);
  }, [code, submitCode]);

  const handleResend = useCallback(async () => {
    if (expiresIn > 0) {
      return;
    }
    const action = isReset
      ? await dispatch(forgotPasswordThunk(email))
      : await dispatch(requestOtpThunk(email));
    const thunk = isReset ? forgotPasswordThunk : requestOtpThunk;
    if (thunk.fulfilled.match(action) && action.payload?.code) {
      setCode(action.payload.code);
    } else {
      setCode('');
    }
    setExpiresIn(OTP_EXPIRY_SECONDS);
  }, [expiresIn, isReset, dispatch, email]);

  const expired = expiresIn <= 0;
  const inlineError = codeError ?? serverError ?? undefined;

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
        <AuthHeader title={copy.title} subtitle={`${copy.intro}\n${email}`} />

        <OtpInput
          value={code}
          onChange={handleChange}
          error={!!inlineError}
          autoFocus
          onComplete={submitCode}
        />

        {inlineError ? <AppText style={styles.errorInline}>{inlineError}</AppText> : null}

        <AppText style={[styles.expiry, expired && styles.expiryExpired]}>
          {expired ? 'Code expired - request a new one' : `Code expires in ${formatMmSs(expiresIn)}`}
        </AppText>

        <Button
          title={copy.submit}
          onPress={handleVerify}
          loading={loading}
          disabled={code.length !== OTP_LENGTH}
          style={styles.submit}
        />

        <View style={styles.resendRow}>
          <AppText style={styles.resendPrompt}>Didn't get the code? </AppText>
          <TouchableOpacity
            onPress={handleResend}
            disabled={!expired}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppText style={[styles.resendAction, !expired && styles.resendDisabled]}>
              {expired ? 'Resend code' : `Resend in ${formatMmSs(expiresIn)}`}
            </AppText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.navigate('Authentication', { mode: copy.backTarget })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <AppText style={styles.backText}>{copy.backLabel}</AppText>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
};

export default OtpScreen;
