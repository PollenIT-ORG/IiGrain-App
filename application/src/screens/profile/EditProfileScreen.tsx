import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useNavigation } from '@react-navigation/native';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { AppIcon, ICONS } from '../../components/AppIcon';
import {
  AppHeader,
  AppPhoneInput,
  AppText,
  Button,
  Input,
} from '../../components';
import type { PhoneNumberValue } from '../../components';
import { COLORS } from '../../constants';
import { capitalize, moderateScale } from '../../utils';
import { useFormValidation } from '../../hooks';
import type { ValidatorMap } from '../../hooks';
import { nameValidator, phoneFieldMessage } from '../../utils/fieldValidators';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  selectProfile,
  selectProfileUpdating,
  updateProfileThunk,
} from '../../redux/slices/userSlice';
import { showSuccess } from '../../services/toastService';
import { styles } from './EditProfileScreenStyle';

type EditProfileValues = {
  fullName: string;
  phone: string;
};

const DEFAULT_COUNTRY = 'US';

const humanizeRole = (role?: string): string =>
  role
    ? role
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map(capitalize)
        .join(' ')
    : '—';

const seedPhone = (
  e164?: string,
): { national: string; country: string; data: PhoneNumberValue | null } => {
  if (!e164) {
    return { national: '', country: DEFAULT_COUNTRY, data: null };
  }
  try {
    const parsed = parsePhoneNumberFromString(e164);
    if (parsed) {
      const iso = parsed.countryCallingCode === '1'
        ? 'US'
        : (parsed.country ?? DEFAULT_COUNTRY);
      return {
        national: parsed.nationalNumber,
        country: iso,
        data: {
          raw: parsed.nationalNumber,
          dialCode: `+${parsed.countryCallingCode}`,
          e164: parsed.number,
          countryCode: iso,
          isValid: parsed.isValid(),
        },
      };
    }
  } catch {
  }
  return { national: e164.replace(/\D/g, ''), country: DEFAULT_COUNTRY, data: null };
};

const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const profile = useAppSelector(selectProfile);
  const updating = useAppSelector(selectProfileUpdating);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phoneData, setPhoneData] = useState<PhoneNumberValue | null>(null);

  const validators = useMemo<ValidatorMap<EditProfileValues>>(
    () => ({ fullName: nameValidator }),
    [],
  );

  const { errors, validateField, validateForm, setFieldError } =
    useFormValidation<EditProfileValues>({ fullName, phone }, validators);

  const seededId = useRef<string | null>(null);
  useEffect(() => {
    if (!profile || seededId.current === profile.id) {
      return;
    }
    seededId.current = profile.id;
    const seed = seedPhone(profile.phone);
    setFullName(profile.fullName ?? '');
    setPhone(seed.national);
    setCountry(seed.country);
    setPhoneData(seed.data);
  }, [profile]);

  const onChangePhoneData = useCallback(
    (data: PhoneNumberValue) => {
      setPhoneData(data);
      if (errors.phone) {
        setFieldError('phone', phoneFieldMessage(data.raw, data.isValid));
      }
    },
    [errors.phone, setFieldError],
  );

  const handleSave = useCallback(async () => {
    if (updating) {
      return;
    }
    const nameValid = validateForm();
    const phoneError = phoneFieldMessage(phone, phoneData?.isValid ?? false);
    setFieldError('phone', phoneError);
    if (!nameValid || phoneError) {
      return;
    }
    const action = await dispatch(
      updateProfileThunk({
        fullName: fullName.trim(),
        phone: phoneData?.e164 ?? '',
      }),
    );

    if (updateProfileThunk.fulfilled.match(action)) {
      // No refetch: updateProfileThunk.fulfilled already stores the updated
      // profile, and authSlice mirrors it onto the auth user.
      showSuccess('Profile updated successfully');
      navigation.goBack();
    }
  }, [updating, validateForm, phone, phoneData, setFieldError, dispatch, fullName, navigation]);

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title="Edit Profile"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}>
        <AppText style={styles.intro}>
          Update your personal details. Email and role are managed by your
          organization and can't be changed here.
        </AppText>

        <Input
          label="Full Name"
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
          label="Phone Number"
          placeholder="Enter your mobile number"
          value={phone}
          onChangeText={setPhone}
          onChange={onChangePhoneData}
          error={errors.phone}
          defaultCountry={country}
          countryLocked
          required
        />

        <View style={styles.readonlyGroup}>
          <AppText style={styles.readonlyLabel}>Email</AppText>
          <View style={styles.readonlyField}>
            <AppText style={styles.readonlyValue} numberOfLines={1}>
              {profile?.email ?? '—'}
            </AppText>
            <AppIcon name={ICONS.LOCK} size={moderateScale(18)} color={COLORS.gray500} />
          </View>
        </View>

        <View style={styles.readonlyGroup}>
          <AppText style={styles.readonlyLabel}>Role</AppText>
          <View style={styles.readonlyField}>
            <AppText style={styles.readonlyValue} numberOfLines={1}>
              {humanizeRole(profile?.role)}
            </AppText>
            <AppIcon name={ICONS.LOCK} size={moderateScale(18)} color={COLORS.gray500} />
          </View>
        </View>

        <View style={{bottom:10 , flex:1}} >
          <Button
          title="Save Changes"
          onPress={handleSave}
          loading={updating}
          style={styles.submit}
        />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default EditProfileScreen;
