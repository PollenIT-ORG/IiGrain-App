import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppHeader, AppText } from '../../components';
import {
  AccountInfoCard,
  AccountSection,
  DangerZoneCard,
  DeleteAccountBottomSheet,
} from '../../components/account';
import { ENTRANCE_TIMING } from '../../components/account/animations';
import { showSuccess } from '../../services/toastService';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { deleteAccountThunk, selectAuthUser } from '../../redux/slices/authSlice';
import { selectProfile } from '../../redux/slices/userSlice';
import {
  APP_VERSION_LABEL,
  DELETE_REMOVES,
  buildAccountInfoItems,
} from './accountData';
import { styles } from './AccountScreenStyle';
import { IMAGES } from '../../assets/images';

const AccountScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const profile = useAppSelector(selectProfile);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const items = useMemo(
    () => buildAccountInfoItems(user, undefined, profile?.createdAt),
    [user, profile?.createdAt],
  );
  const displayName = user?.fullName?.trim() || 'iiGrain User';
  const roleLabel =
    (user?.role ?? '').trim().toLowerCase() === 'assessor' ? 'Assessor' : 'Farmer';

  const opacity = useSharedValue(0);
  const rise = useSharedValue(16);
  useEffect(() => {
    opacity.value = withTiming(1, ENTRANCE_TIMING);
    rise.value = withTiming(0, ENTRANCE_TIMING);
  }, [opacity, rise]);
  const bodyAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: rise.value }],
  }));

  const openSheet = useCallback(() => {
    setDeleteError(null);
    setSheetVisible(true);
  }, []);
  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setDeleteError(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await dispatch(deleteAccountThunk()).unwrap();
      showSuccess('Your account has been permanently deleted.');
    } catch (err) {
      setDeleting(false);
      const message =
        (err as { message?: string } | undefined)?.message ??
        'We could not delete your account. Please try again.';
      setDeleteError(message);
    }
  }, [dispatch]);

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Account" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <Animated.View style={bodyAnim}>
          <View style={styles.hero}>
               <Image source={IMAGES.logo} style={styles.logo} resizeMode="contain" />

            <AppText style={styles.name} numberOfLines={1}>
              {displayName}
            </AppText>
            {user?.email ? (
              <AppText style={styles.email} numberOfLines={1}>
                {user.email}
              </AppText>
            ) : null}
            <View style={styles.rolePill}>
              <AppText style={styles.roleText}>{roleLabel}</AppText>
            </View>
          </View>

          <AppText style={styles.subtitle} align="center">
            Review your account details and manage your data below.
          </AppText>

          <AccountSection title="ACCOUNT INFORMATION">
            <AccountInfoCard items={items} />
          </AccountSection>

          <AccountSection title="DANGER ZONE">
            <DangerZoneCard items={DELETE_REMOVES} onDelete={openSheet} />
          </AccountSection>

          <View style={styles.footer}>
            <AppText style={styles.footerText} align="center">
              iiGrain • Version {APP_VERSION_LABEL}
            </AppText>
            <AppText style={styles.footerText} align="center">
              © 2026 iiGrain. All rights reserved.
            </AppText>
          </View>
        </Animated.View>
      </ScrollView>

      <DeleteAccountBottomSheet
        visible={sheetVisible}
        items={DELETE_REMOVES}
        loading={deleting}
        error={deleteError}
        onClose={closeSheet}
        onConfirm={handleConfirmDelete}
      />
    </View>
  );
};

export default AccountScreen;
