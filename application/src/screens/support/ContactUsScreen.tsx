import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import {
  AppHeader,
  AppPhoneInput,
  AppText,
  Button,
  Input,
  NoticeCard,
} from '../../components';
import { ICONS } from '../../components/AppIcon';
import type { PhoneNumberValue } from '../../components';
import { useFormValidation } from '../../hooks';
import type { ValidatorMap } from '../../hooks';
import { emailValidator } from '../../utils/fieldValidators';
import type { FieldValidator } from '../../utils/fieldValidators';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import { selectSubmittingEnquiry } from '../../redux/slices/supportSlice';
import { submitContactEnquiryThunk } from '../../redux/thunks/supportThunks';
import { showSuccess } from '../../services/toastService';
import { CONTACT_LIMITS } from '../../types/support';
import type { ContactField, ContactFieldErrors } from '../../types/support';
import type { AuthStackParamList } from '../../navigation/navigationTypes';
import { styles } from './ContactUsScreenStyle';

type ContactValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type TextContactField = Exclude<ContactField, 'phone'>;

type ContactRoute = RouteProp<AuthStackParamList, 'ContactUs'>;

const boundedValidator =
  (label: string, min: number, max: number): FieldValidator<ContactValues> =>
  value => {
    const trimmed = value.trim();
    if (!trimmed) {
      return `${label} is required`;
    }
    if (trimmed.length < min) {
      return `${label} must be at least ${min} characters`;
    }
    if (trimmed.length > max) {
      return `${label} cannot be longer than ${max} characters`;
    }
    return undefined;
  };

const contactEmailValidator: FieldValidator<ContactValues> = (value, values) => {
  const base = emailValidator(value, values);
  if (base) {
    return base;
  }
  return value.trim().length <= CONTACT_LIMITS.email.max
    ? undefined
    : `Email cannot be longer than ${CONTACT_LIMITS.email.max} characters`;
};

const ContactUsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ContactRoute>();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const submitting = useAppSelector(selectSubmittingEnquiry);

  const [name, setName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(route.params?.email ?? user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState(route.params?.subject ?? '');
  const [message, setMessage] = useState(route.params?.message ?? '');

  const [phoneData, setPhoneData] = useState<PhoneNumberValue | null>(null);
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [serverErrors, setServerErrors] = useState<ContactFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const validators = useMemo<ValidatorMap<ContactValues>>(
    () => ({
      name: boundedValidator('Name', CONTACT_LIMITS.name.min, CONTACT_LIMITS.name.max),
      email: contactEmailValidator,
      subject: boundedValidator(
        'Subject',
        CONTACT_LIMITS.subject.min,
        CONTACT_LIMITS.subject.max,
      ),
      message: boundedValidator(
        'Description',
        CONTACT_LIMITS.message.min,
        CONTACT_LIMITS.message.max,
      ),
    }),
    [],
  );

  const { errors, validateField, validateForm } = useFormValidation<ContactValues>(
    { name, email, subject, message },
    validators,
  );

  const clearServerError = useCallback((field: ContactField) => {
    setServerErrors(prev => {
      if (prev[field] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const errorFor = useCallback(
    (field: TextContactField): string | undefined => errors[field] ?? serverErrors[field],
    [errors, serverErrors],
  );

  const onChangeName = useCallback(
    (text: string) => {
      setName(text);
      clearServerError('name');
    },
    [clearServerError],
  );

  const onChangeEmail = useCallback(
    (text: string) => {
      setEmail(text);
      clearServerError('email');
    },
    [clearServerError],
  );

  const onChangeSubject = useCallback(
    (text: string) => {
      setSubject(text);
      clearServerError('subject');
    },
    [clearServerError],
  );

  const onChangeMessage = useCallback(
    (text: string) => {
      setMessage(text);
      clearServerError('message');
    },
    [clearServerError],
  );

  const onChangePhoneData = useCallback(
    (data: PhoneNumberValue) => {
      setPhoneData(data);
      setPhoneError(undefined);
      clearServerError('phone');
    },
    [clearServerError],
  );

  const validatePhone = useCallback((): string | undefined => {
    if (!phone.trim()) {
      return undefined;
    }
    return phoneData?.isValid ? undefined : 'Enter a valid phone number';
  }, [phone, phoneData]);

  const handleSubmit = useCallback(async () => {
    if (submitting) {
      return;
    }
    setFormError(null);
    setServerErrors({});

    const stringsValid = validateForm();
    const nextPhoneError = validatePhone();
    setPhoneError(nextPhoneError);
    if (!stringsValid || nextPhoneError) {
      return;
    }

    const action = await dispatch(
      submitContactEnquiryThunk({
        name,
        email,
        phone: phone.trim() ? phoneData?.e164 ?? '' : '',
        subject,
        message,
      }),
    );

    if (submitContactEnquiryThunk.fulfilled.match(action)) {
      showSuccess(action.payload.message);
      navigation.goBack();
      return;
    }

    const failure = action.payload;
    const fieldErrors = failure?.fieldErrors ?? {};
    if (Object.keys(fieldErrors).length > 0) {
      setServerErrors(fieldErrors);
      setPhoneError(fieldErrors.phone);
      return;
    }
    setFormError(failure?.presentation.message ?? failure?.message ?? null);
  }, [
    submitting,
    validateForm,
    validatePhone,
    dispatch,
    name,
    email,
    phone,
    phoneData,
    subject,
    message,
    navigation,
  ]);

  const counter = `${message.trim().length}/${CONTACT_LIMITS.message.max}`;

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Contact Us" onBack={() => navigation.goBack()} />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}>
        <AppText style={styles.intro}>
          Tell us what you need help with and our team will reply by email.
        </AppText>

        {formError ? (
          <NoticeCard
            tone="warning"
            icon={ICONS.WARNING}
            title="Message not sent"
            message={formError}
            style={styles.notice}
          />
        ) : null}

        <Input
          label="Full Name"
          required
          placeholder="Enter your full name"
          value={name}
          onChangeText={onChangeName}
          onValidate={v => validateField('name', { name: v })}
          error={errorFor('name')}
          autoCapitalize="words"
          textContentType="name"
          maxLength={CONTACT_LIMITS.name.max}
        />

        <Input
          label="Email"
          required
          placeholder="Enter your email address"
          value={email}
          onChangeText={onChangeEmail}
          onValidate={v => validateField('email', { email: v })}
          error={errorFor('email')}
          hint="We reply to this address."
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          maxLength={CONTACT_LIMITS.email.max}
        />

        <AppPhoneInput
          label="Phone Number (optional)"
          placeholder="Enter your mobile number"
          value={phone}
          onChangeText={setPhone}
          onChange={onChangePhoneData}
          error={phoneError}
        />

        <Input
          label="Subject"
          required
          placeholder="What is this about?"
          value={subject}
          onChangeText={onChangeSubject}
          onValidate={v => validateField('subject', { subject: v })}
          error={errorFor('subject')}
          autoCapitalize="sentences"
          maxLength={CONTACT_LIMITS.subject.max}
        />

        <Input
          label="Description"
          required
          placeholder="Describe the problem in as much detail as you can"
          value={message}
          onChangeText={onChangeMessage}
          onValidate={v => validateField('message', { message: v })}
          error={errorFor('message')}
          multiline
          numberOfLines={6}
          autoCapitalize="sentences"
          maxLength={CONTACT_LIMITS.message.max}
        />

        <AppText style={styles.counter}>{counter}</AppText>

        <Button
          title="Send Message"
          onPress={handleSubmit}
          loading={submitting}
          style={styles.submit}
        />
      </KeyboardAwareScrollView>
    </View>
  );
};

export default ContactUsScreen;
