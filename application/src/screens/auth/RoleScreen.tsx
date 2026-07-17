import React, { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppStatusBar, AppText, AuthHeader, Button } from '../../components';
import type { DropdownOption } from '../../components';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  clearError,
  selectAuthError,
  selectAuthLoading,
  signupThunk,
} from '../../redux/slices/authSlice';
import { getRoles } from '../../api/authApi';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import type { AuthScreenProps } from '../../navigation/navigationTypes';
import { styles } from './RoleScreenStyle';

const FALLBACK_ROLES: DropdownOption[] = [
  { value: 'farmer', label: 'Farmer' },
  { value: 'assessor', label: 'Assessor' },
];

const ROLE_META: Record<string, { icon: string; description: string }> = {
  farmer: { icon: 'tractor-variant', description: 'Track farms & assessments' },
  assessor: { icon: 'clipboard-check-outline', description: 'Evaluate & score farms' },
  program_partner: { icon: 'handshake-outline', description: 'Oversee programs & partners' },
};
const DEFAULT_META = { icon: 'account-outline', description: '' };

const toRows = <T,>(items: T[]): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
};

const RoleScreen: React.FC<AuthScreenProps<'Role'>> = ({ route, navigation }) => {
  const { fullName, email, phone, password } = route.params;
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const serverError = useAppSelector(selectAuthError);

  const [roles, setRoles] = useState<DropdownOption[]>(FALLBACK_ROLES);
  const [selected, setSelected] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    try {
      const list = await getRoles();
      if (list.length > 0) {
        setRoles(list);
      }
    } catch (err) {
      if (__DEV__) {
        console.log('[role] roles API failed, using static fallback:', err);
      }
    }
  }, []);

  useEffect(() => {
    dispatch(clearError());
    loadRoles();
  }, [dispatch, loadRoles]);

  const handleCreate = useCallback(async () => {
    if (loading || !selected) {
      return;
    }
    const action = await dispatch(
      signupThunk({ fullName, email, phone, password, role: selected }),
    );
    if (signupThunk.fulfilled.match(action)) {
      navigation.navigate('Otp', {
        email,
        code: action.payload.code,
        mode: 'verify',
      });
    }
  }, [loading, selected, dispatch, fullName, email, phone, password, navigation]);

  const renderCard = (role: DropdownOption, fullWidth: boolean) => {
    const meta = ROLE_META[role.value] ?? DEFAULT_META;
    const isActive = selected === role.value;
    return (
      <TouchableOpacity
        key={role.value}
        activeOpacity={0.85}
        onPress={() => setSelected(role.value)}
        accessibilityRole="radio"
        accessibilityState={{ selected: isActive }}
        style={[
          styles.card,
          fullWidth ? styles.cardFull : styles.cardHalf,
          isActive && styles.cardActive,
        ]}>
        {isActive ? (
          <View style={styles.checkBadge}>
            <AppIcon name={ICONS.CHECK} size={moderateScale(13)} color={COLORS.white} />
          </View>
        ) : null}

        <View style={[styles.iconCircle,
          isActive ?
          styles.iconCircleActive:
          styles.iconCircleInActive
          ]}>
          <AppIcon
            name={meta.icon}
            size={moderateScale(26)}
            color={
              COLORS.primary
              }
          />
        </View>

        <AppText style={[styles.cardLabel, isActive && styles.cardLabelActive]} numberOfLines={1}>
          {role.label}
        </AppText>
        {meta.description ? (
          <AppText style={styles.cardDescription} numberOfLines={2}>
            {meta.description}
          </AppText>
        ) : null}
      </TouchableOpacity>
    );
  };

  const rows = toRows(roles);

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
          title="Choose your role"
          subtitle="Select how you'll use iiGrain so we can tailor your experience"
        />

        <View style={styles.grid}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map(role => renderCard(role, row.length === 1))}
            </View>
          ))}
        </View>

        {serverError ? (
          <View style={styles.errorBanner}>
            <AppText style={styles.errorText}>{serverError}</AppText>
          </View>
        ) : null}

        <Button
          title="Create Account"
          onPress={handleCreate}
          loading={loading}
          disabled={!selected}
          style={styles.submit}
        />

        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <AppText style={styles.backText}>Back</AppText>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
    </View>
  );
};

export default RoleScreen;
