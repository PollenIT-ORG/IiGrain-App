import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View, type TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AppPhoneInput,
  AppText,
  Button,
  Input,
  NoticeCard,
  PasswordStrength,
} from '../../../components';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import type { InputHintTone, PhoneNumberValue } from '../../../components';
import { COLORS } from '../../../constants';
import { moderateScale } from '../../../utils';
import { useEnrollmentIdLookup } from './useEnrollmentIdLookup';
import { useDebouncedValue, useFormValidation } from '../../../hooks';
import { checkEmailAvailability } from '../../../api/authApi';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  clearError,
  selectAuthLoading,
  signupThunk,
} from '../../../redux/slices/authSlice';
import type { StandardizedError } from '../../../utils/handleApiError';
import type { ValidatorMap } from '../../../hooks';
import {
  confirmPasswordValidator,
  emailValidator,
  enrollmentIdValidator,
  nameValidator,
  passwordValidator,
  phoneFieldMessage,
} from '../../../utils/fieldValidators';
import {
  ENROLLMENT_ID_EXAMPLE,
  ENROLLMENT_ID_MAX_LENGTH,
  formatEnrollmentIdInput,
  isEnrollmentIdShaped,
  normalizeEnrollmentId,
} from '../../../utils/enrollmentId';
import type { AuthStackParamList } from '../../../navigation/navigationTypes';
import { styles } from './SignupFormStyle';

const EMAIL_TAKEN = 'This email is already registered. Try logging in instead.';

const ENROLLMENT_HINT = {
  idle: 'Sent to you by email when your survey was accepted.',
  checking: 'Checking your Enrollment ID...',
  matched: 'That looks like a valid Enrollment ID.',
  confirmed: 'We found your enrollment.',
  unmatched: `Most IDs look like ${ENROLLMENT_ID_EXAMPLE}. Enter yours exactly as sent.`,
} as const;

const EMAIL_HINT = {
  typed: 'Use the address your Enrollment ID was sent to.',
  resolved:
    'This is the address your Enrollment ID was sent to. Your verification code goes here.',
} as const;

const NAME_HINT = 'This is the name on your enrollment, so it cannot be edited here.';

const ENROLLMENT_FAILURE_CODES: ReadonlySet<string> = new Set([
  'ENROLLMENT_ID_NOT_FOUND',
  'ENROLLMENT_ID_REQUIRED',
  'ENROLLMENT_ID_EMAIL_MISMATCH',
]);

const EXISTING_ACCOUNT_CODES: ReadonlySet<string> = new Set([
  'ALREADY_REGISTERED',
  'ACCOUNT_ALREADY_EXISTS',
]);

type SignupValues = {
  enrollmentId: string;
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type Nav = NativeStackNavigationProp<AuthStackParamList>;
type AuthRoute = RouteProp<AuthStackParamList, 'Authentication'>;

const SignupForm: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<AuthRoute>();
  const dispatch = useAppDispatch();
  const creating = useAppSelector(selectAuthLoading);

  const [enrollmentId, setEnrollmentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [phoneData, setPhoneData] = useState<PhoneNumberValue | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [failure, setFailure] = useState<StandardizedError | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const checkedEmailRef = useRef<{ email: string; available: boolean } | null>(null);
  const enrollmentInputRef = useRef<TextInput>(null);

  const lookup = useEnrollmentIdLookup(enrollmentId);
  const resolvedEmail = lookup.result?.maskedEmail ?? '';
  const emailLocked = resolvedEmail.length > 0;
  const resolvedName = lookup.result?.fullName ?? null;
  const nameLocked = Boolean(resolvedName);

  const prefilledName = useRef<string | null>(null);
  useEffect(() => {
    if (resolvedName) {
      setFullName(resolvedName);
    } else if (prefilledName.current) {
      setFullName('');
    }
    prefilledName.current = resolvedName;
  }, [resolvedName]);

  const validators = useMemo<ValidatorMap<SignupValues>>(
    () => ({
      enrollmentId: enrollmentIdValidator,
      ...(nameLocked ? {} : { fullName: nameValidator }),
      ...(emailLocked ? {} : { email: emailValidator }),
      password: passwordValidator,
      confirmPassword: confirmPasswordValidator<SignupValues>('password'),
    }),
    [emailLocked, nameLocked],
  );

  const { errors, validateField, validateForm, setFieldError } =
    useFormValidation<SignupValues>(
      { enrollmentId, fullName, phone, email, password, confirmPassword },
      validators,
    );

  const trimmedEmail = email.trim();
  const debouncedEmail = useDebouncedValue(emailLocked ? '' : trimmedEmail, 500);

  const serverEnrollmentError = route.params?.enrollmentError;
  useEffect(() => {
    if (!serverEnrollmentError) {
      return;
    }
    setFieldError('enrollmentId', serverEnrollmentError);
    navigation.setParams({ enrollmentError: undefined });
    const focus = setTimeout(() => enrollmentInputRef.current?.focus(), 250);
    return () => clearTimeout(focus);
  }, [serverEnrollmentError, setFieldError, navigation]);

  useEffect(() => {
    if (!debouncedEmail || emailValidator(debouncedEmail, {})) {
      setEmailTaken(false);
      return;
    }
    const cached = checkedEmailRef.current;
    if (cached?.email === debouncedEmail) {
      setEmailTaken(!cached.available);
      return;
    }
    let alive = true;
    setCheckingEmail(true);
    checkEmailAvailability(debouncedEmail)
      .then(result => {
        if (!alive) {
          return;
        }
        checkedEmailRef.current = {
          email: debouncedEmail,
          available: result.available,
        };
        setEmailTaken(!result.available);
      })
      .catch(() => {
        if (alive) {
          setEmailTaken(false);
        }
      })
      .finally(() => {
        if (alive) {
          setCheckingEmail(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [debouncedEmail]);

  const onChangeEnrollmentId = useCallback(
    (text: string) => {
      const formatted = formatEnrollmentIdInput(text);
      setEnrollmentId(formatted);
      if (errors.enrollmentId) {
        validateField('enrollmentId', { enrollmentId: formatted });
      }
    },
    [errors.enrollmentId, validateField],
  );

  const onChangeEmail = useCallback((text: string) => {
    setEmail(text);
    setEmailTaken(false);
  }, []);

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

  const enrollmentHint = useMemo<{ text: string; tone: InputHintTone }>(() => {
    if (!enrollmentId.trim()) {
      return { text: ENROLLMENT_HINT.idle, tone: 'muted' };
    }
    if (lookup.checking) {
      return { text: ENROLLMENT_HINT.checking, tone: 'muted' };
    }
    if (lookup.result) {
      return { text: ENROLLMENT_HINT.confirmed, tone: 'success' };
    }
    return isEnrollmentIdShaped(enrollmentId)
      ? { text: ENROLLMENT_HINT.matched, tone: 'success' }
      : { text: ENROLLMENT_HINT.unmatched, tone: 'muted' };
  }, [enrollmentId, lookup.checking, lookup.result]);

  const enrollmentError =
    errors.enrollmentId ?? (lookup.kind === 'notFound' ? lookup.error ?? undefined : undefined);

  const goToLogin = useCallback(() => {
    navigation.navigate('Authentication', { mode: 'login' }, { pop: true });
  }, [navigation]);

  const handleCreateAccount = useCallback(async () => {
    if (creating) {
      return;
    }
    const stringsValid = validateForm();
    const phoneError = phoneFieldMessage(phone, phoneData?.isValid ?? false);
    setFieldError('phone', phoneError);
    if (!stringsValid || phoneError) {
      return;
    }

    let value = '';
    if (!emailLocked) {
      value = email.trim();
      const cached = checkedEmailRef.current;
      let available = cached?.email === value ? cached.available : undefined;
      if (available === undefined) {
        setCheckingEmail(true);
        try {
          available = (await checkEmailAvailability(value)).available;
          checkedEmailRef.current = { email: value, available };
        } catch {
          available = true;
        } finally {
          setCheckingEmail(false);
        }
      }
      if (!available) {
        setEmailTaken(true);
        return;
      }
    }

    setFailure(null);
    dispatch(clearError());

    const action = await dispatch(
      signupThunk({
        fullName: fullName.trim(),
        email: value,
        phone: phoneData?.e164 ?? '',
        password,
        enrollmentId: normalizeEnrollmentId(enrollmentId),
      }),
    );

    if (signupThunk.fulfilled.match(action)) {
      navigation.navigate('Otp', {
        email: action.payload.email,
        code: action.payload.code,
        mode: 'verify',
      });
      return;
    }

    const rejection = action.payload ?? null;
    if (rejection && ENROLLMENT_FAILURE_CODES.has(rejection.code)) {
      setFieldError('enrollmentId', rejection.message);
      enrollmentInputRef.current?.focus();
      return;
    }
    setFailure(rejection);
  }, [
    creating,
    validateForm,
    phone,
    phoneData,
    setFieldError,
    dispatch,
    navigation,
    fullName,
    email,
    emailLocked,
    password,
    enrollmentId,
  ]);

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bottomOffset={24}>
      <Input
        ref={enrollmentInputRef}
        label="Enrollment ID*"
        placeholder={ENROLLMENT_ID_EXAMPLE}
        value={enrollmentId}
        onChangeText={onChangeEnrollmentId}
        onValidate={v => validateField('enrollmentId', { enrollmentId: v })}
        error={enrollmentError}
        hint={enrollmentHint.text}
        hintTone={enrollmentHint.tone}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={ENROLLMENT_ID_MAX_LENGTH}
        returnKeyType="next"
      />

      {lookup.checking ? (
        <View style={styles.lookupRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <AppText style={styles.lookupText}>Checking your Enrollment ID...</AppText>
        </View>
      ) : null}

      {lookup.result ? (
        <View style={styles.matchCard}>
          <View style={styles.matchHead}>
            <View style={styles.matchIcon}>
              <AppIcon
                name={ICONS.CHECK}
                size={moderateScale(16)}
                color={COLORS.white}
              />
            </View>
            <View style={styles.matchHeadTexts}>
              <AppText style={styles.matchTitle}>Enrollment found</AppText>
              {lookup.result.programName ? (
                <AppText style={styles.matchProgram} numberOfLines={2}>
                  {lookup.result.programName}
                </AppText>
              ) : null}
            </View>
          </View>

          <AppText style={styles.matchNote}>
            {resolvedName
              ? 'Your name and email are filled in below. We hide part of your email to keep your address private.'
              : 'Your email is filled in below. We hide part of it to keep your address private.'}
          </AppText>
        </View>
      ) : null}

      {lookup.kind === 'unavailable' && lookup.error ? (
        <NoticeCard
          tone="info"
          icon={ICONS.OFFLINE}
          title="Could not check that ID"
          message={lookup.error}
          style={styles.lookupNotice}
        />
      ) : null}

      {nameLocked ? (
        <View style={styles.lockedGroup}>
          <AppText style={styles.lockedLabel}>Full Name</AppText>
          <View style={styles.lockedField}>
            <AppText style={styles.lockedValue} numberOfLines={1}>
              {fullName}
            </AppText>
            <AppIcon
              name="lock-outline"
              size={moderateScale(16)}
              color={COLORS.gray500}
            />
          </View>
          <View style={styles.lockedHintRow}>
            <AppIcon
              name={ICONS.CHECK_CIRCLE}
              size={moderateScale(13)}
              color={COLORS.success}
            />
            <AppText style={styles.lockedHint}>{NAME_HINT}</AppText>
          </View>
        </View>
      ) : (
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
      )}

      <AppPhoneInput
        label="Phone Number*"
        placeholder="Enter your mobile number"
        value={phone}
        onChangeText={setPhone}
        onChange={onChangePhoneData}
        error={errors.phone}
        required
      />

      {lookup.result?.maskedPhone && !errors.phone ? (
        <View style={styles.phoneNoteRow}>
          <AppIcon
            name="information-outline"
            size={moderateScale(13)}
            color={COLORS.gray500}
          />
          <AppText style={styles.phoneNote}>
            We have {lookup.result.maskedPhone} on file. Enter your full number to
            confirm it.
          </AppText>
        </View>
      ) : null}

      {emailLocked ? (
        <View style={styles.lockedGroup}>
          <AppText style={styles.lockedLabel}>Email</AppText>
          <View style={styles.lockedField}>
            <AppText style={styles.lockedValue} numberOfLines={1}>
              {resolvedEmail}
            </AppText>
            <AppIcon
              name="lock-outline"
              size={moderateScale(16)}
              color={COLORS.gray500}
            />
          </View>
          <View style={styles.lockedHintRow}>
            <AppIcon
              name={ICONS.CHECK_CIRCLE}
              size={moderateScale(13)}
              color={COLORS.success}
            />
            <AppText style={styles.lockedHint}>{EMAIL_HINT.resolved}</AppText>
          </View>
        </View>
      ) : (
        <Input
          label="Email*"
          placeholder="Enter your email address"
          value={email}
          onChangeText={onChangeEmail}
          onValidate={v => validateField('email', { email: v })}
          error={errors.email ?? (emailTaken ? EMAIL_TAKEN : undefined)}
          hint={EMAIL_HINT.typed}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />
      )}

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

      {failure ? (
        <NoticeCard
          tone={EXISTING_ACCOUNT_CODES.has(failure.code) ? 'info' : 'danger'}
          icon={
            EXISTING_ACCOUNT_CODES.has(failure.code) ? ICONS.USER_CIRCLE : ICONS.ERROR
          }
          title={
            EXISTING_ACCOUNT_CODES.has(failure.code)
              ? 'You already have an account'
              : "We couldn't create your account"
          }
          message={failure.message}
          primaryAction={
            EXISTING_ACCOUNT_CODES.has(failure.code)
              ? { label: 'Go to login', onPress: goToLogin }
              : undefined
          }
          style={styles.signupNotice}
        />
      ) : null}

      <Button
        title="Create Account"
        onPress={handleCreateAccount}
        loading={checkingEmail || creating}
        style={styles.submit}
      />
    </KeyboardAwareScrollView>
  );
};

export default React.memo(SignupForm);
