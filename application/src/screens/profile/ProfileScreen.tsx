import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import {
  AppShimmerAvatar,
  AppShimmerList,
  AppShimmerRow,
  AppShimmerText,
} from '../../components/Shimmer';
import AppImageViewer from '../../components/AppImageViewer/AppImageViewer';
import ImagePickerBottomSheet, {
  type SheetAction,
} from '../../components/AppImagePicker/ImagePickerBottomSheet';
import { imagePickerService } from '../../services/imagePickerService';
import { openAppSettings } from '../../permissions/mediaPermissions';
import { showToast } from '../../services/toastService';
import type { ImagePickerResult, MediaFile } from '../../types/media';
import { COLORS, spacing } from '../../constants';
import { GENERIC_ERROR_MESSAGE } from '../../config/errorMessages';
import { capitalize, getInitials, moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchProfileThunk,
  removeAvatarThunk,
  selectAvatarUpdating,
  selectProfileError,
  selectProfileLoading,
  uploadAvatarThunk,
} from '../../redux/slices/userSlice';
import { selectCurrentProfile } from '../../redux/selectors/profileSelectors';
import { logoutThunk } from '../../redux/slices/authSlice';
import { getMyOrganization } from '../../api/OrganizationApi';
import type { UserProfile } from '../../api/profileApi';
import type { Organization } from '../../types/organization';
import type { AppStackParamList } from '../../navigation/navigationTypes';
import type { HeaderAction } from '../../components';
import { styles } from './ProfileScreenStyle';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const humanizeRole = (role?: string): string =>
  role
    ? role
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map(capitalize)
        .join(' ')
    : '—';

const formatDate = (iso?: string): string | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
};

const ProfileSkeleton: React.FC = () => (
  <View>
    <View style={styles.identity}>
      <AppShimmerAvatar size={scale(96)} style={skStyles.avatarSpacing} />
      <AppShimmerText
        width={scale(180)}
        height={moderateScale(20)}
        style={styles.skeletonCentered}
      />
      <AppShimmerText
        width={scale(140)}
        height={moderateScale(12)}
        style={styles.skeletonCenteredSpaced}
      />
    </View>

    <AppShimmerText
      width={scale(120)}
      height={moderateScale(10)}
      style={styles.sectionTitle}
    />
    <View style={styles.card}>
      <AppShimmerList
        count={3}
        spacing={0}
        renderItem={index => (
          <AppShimmerRow
            leadingSize={scale(36)}
            style={[styles.infoRow, index < 2 && styles.rowBorder]}
          />
        )}
      />
    </View>
  </View>
);

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
  border?: boolean;
}
const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, border }) => (
  <View style={[styles.infoRow, border && styles.rowBorder]}>
    <View style={styles.infoIcon}>
      <AppIcon name={icon} size={moderateScale(18)} color={COLORS.primary} />
    </View>
    <View style={styles.infoTextWrap}>
      <AppText style={styles.infoLabel}>{label}</AppText>
      <AppText style={styles.infoValue}>{value}</AppText>
    </View>
  </View>
);

interface ActionRowProps {
  icon: string;
  label: string;
  onPress: () => void;
  border?: boolean;
}
const ActionRow: React.FC<ActionRowProps> = ({ icon, label, onPress, border }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    style={[styles.actionRow, border && styles.rowBorder]}>
    <View style={styles.infoIcon}>
      <AppIcon name={icon} size={moderateScale(18)} color={COLORS.primary} />
    </View>
    <AppText style={styles.actionLabel}>{label}</AppText>
    <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(22)} color={COLORS.gray500} />
  </TouchableOpacity>
);

interface OrgCardProps {
  org: Organization | null;
  loading: boolean;
}

const OrganizationCard: React.FC<OrgCardProps> = ({ org, loading }) => {
  if (loading) {
    return (
      <>
        <AppText style={styles.sectionTitle}>Organization</AppText>
        <View style={[styles.card, styles.orgLoadingCard]}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      </>
    );
  }

  if (!org) {
    return (
      <>
        <AppText style={styles.sectionTitle}>Organization</AppText>
        <View style={styles.card}>
          <View style={styles.orgEmptyRow}>
            <AppIcon name={ICONS.COMPANY} size={moderateScale(22)} color={COLORS.gray500} />
            <AppText style={styles.orgEmptyText}>No organization assigned yet</AppText>
          </View>
        </View>
      </>
    );
  }

  const assignedDate = formatDate(org.assignedAt ?? undefined);
  const isActive = org.status === 'active';

  return (
    <>
      <AppText style={styles.sectionTitle}>Organization</AppText>
      <View style={styles.card}>
        <InfoRow icon="office-building-outline" label="Name" value={org.name} border />
        {org.role ? (
          <InfoRow icon="account-tie-outline" label="Role" value={humanizeRole(org.role)} border />
        ) : null}
        <InfoRow
          icon="check-circle-outline"
          label="Status"
          value={isActive ? 'Active' : 'Inactive'}
          border={!!assignedDate}
        />
        {assignedDate ? (
          <InfoRow icon="calendar-outline" label="Assigned" value={assignedDate} />
        ) : null}
      </View>
    </>
  );
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();

  const profile = useAppSelector(selectCurrentProfile);
  const loading = useAppSelector(selectProfileLoading);
  const avatarUpdating = useAppSelector(selectAvatarUpdating);
  const error = useAppSelector(selectProfileError);

  const [refreshing, setRefreshing] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);

  const [org, setOrg] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  const loadOrganization = useCallback(async () => {
    setOrgLoading(true);
    try {
      const result = await getMyOrganization();
      setOrg(result);
    } catch {
      setOrg(null);
    } finally {
      setOrgLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchProfileThunk({ force: true })),
      loadOrganization(),
    ]);
    setRefreshing(false);
  }, [dispatch, loadOrganization]);

  const goToEdit = useCallback(() => navigation.navigate('EditProfile'), [navigation]);
  const goToChangePassword = useCallback(
    () => navigation.navigate('ChangePassword'),
    [navigation],
  );

  const onHeaderAction = useCallback(
    (action: HeaderAction) => {
      if (action === 'edit') {
        goToEdit();
      }
    },
    [goToEdit],
  );

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    await dispatch(logoutThunk());
  }, [dispatch]);

  const uploadPhoto = useCallback(async (file: MediaFile) => {
    const action = await dispatch(uploadAvatarThunk(file));
    if (uploadAvatarThunk.fulfilled.match(action)) {
      showToast('Profile photo updated.', { type: 'success' });
      return;
    }
    showToast(action.payload?.message ?? 'Failed to update profile photo.', {
      type: 'error',
    });
  }, [dispatch]);

  const handlePickResult = useCallback((result: ImagePickerResult) => {
    if (result.status === 'cancelled') {
      return;
    }
    if (result.status === 'error') {
      if (result.error.code === 'PERMISSION_BLOCKED') {
        openAppSettings();
      }
      showToast(result.error.message, { type: 'error' });
      return;
    }
    uploadPhoto(result.files[0]);
  }, [uploadPhoto]);

  const runPick = useCallback(
    async (fn: () => Promise<ImagePickerResult>) => {
      if (pickerLoading) {
        return;
      }
      setPickerLoading(true);
      try {
        handlePickResult(await fn());
      } finally {
        setPickerLoading(false);
      }
    },
    [pickerLoading, handlePickResult],
  );

  const handleCamera = useCallback(
    () =>
      runPick(() =>
        imagePickerService.openCamera({
          aspectRatio: { width: 1, height: 1 },
          crop: true,
          maxSizeMB: 5,
        }),
      ),
    [runPick],
  );

  const handleGallery = useCallback(
    () =>
      runPick(() =>
        imagePickerService.pickImage({
          aspectRatio: { width: 1, height: 1 },
          crop: true,
          maxSizeMB: 5,
        }),
      ),
    [runPick],
  );

  const handleViewPhoto = useCallback(() => setPhotoViewerVisible(true), []);
  const handleRemovePhoto = useCallback(async () => {
    const action = await dispatch(removeAvatarThunk());
    if (removeAvatarThunk.fulfilled.match(action)) {
      setPhotoViewerVisible(false);
      showToast('Profile photo removed.', { type: 'success' });
      return;
    }
    showToast(action.payload?.message ?? 'Failed to remove profile photo.', {
      type: 'error',
    });
  }, [dispatch]);

  const photoSheetActions = useMemo<SheetAction[]>(() => {
    const actions: SheetAction[] = [];
    const hasAvatar = !!profile?.avatarUrl;
    if (hasAvatar) {
      actions.push({
        key: 'view',
        icon: 'eye-outline',
        label: 'View Photo',
        onPress: handleViewPhoto,
      });
    }
    actions.push(
      { key: 'camera', icon: 'camera-plus-outline', label: 'Take Photo', onPress: handleCamera },
      {
        key: 'gallery',
        icon: 'image-multiple-outline',
        label: 'Choose from Gallery',
        onPress: handleGallery,
      },
    );
    if (hasAvatar) {
      actions.push({
        key: 'remove',
        icon: 'trash-can-outline',
        label: 'Remove Photo',
        onPress: handleRemovePhoto,
        danger: true,
      });
    }
    return actions;
  }, [profile?.avatarUrl, handleViewPhoto, handleCamera, handleGallery, handleRemovePhoto]);

  const renderContent = (data: UserProfile) => {
    const created = formatDate(data.createdAt);
    const avatarUrl = data.avatarUrl ?? null;
    return (
      <>
        <View style={styles.identity}>
          <View style={localStyles.avatarWrap}>
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <AppText style={styles.avatarText}>
                  {getInitials(data.fullName) || getInitials(data.email) || '?'}
                </AppText>
              )}
              {avatarUpdating ? (
                <View style={localStyles.avatarLoading}>
                  <ActivityIndicator size="small" color={COLORS.white} />
                </View>
              ) : null}
            </View>
            <Pressable
              onPress={() => setPhotoSheetVisible(true)}
              disabled={avatarUpdating || pickerLoading}
              style={localStyles.avatarEditBadge}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo">
              {avatarUpdating || pickerLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <AppIcon name="camera" size={moderateScale(14)} color={COLORS.white} />
              )}
            </Pressable>
          </View>
          <AppText style={styles.name}>{data.fullName || '—'}</AppText>
          <AppText style={styles.email}>{data.email}</AppText>
          <AppText style={styles.roleBadge}>{humanizeRole(data.role)}</AppText>
        </View>

        <AppText style={styles.sectionTitle}>Account details</AppText>
        <View style={styles.card}>
          <InfoRow icon="email-outline" label="Email" value={data.email} border />
          <InfoRow
            icon="phone-outline"
            label="Phone number"
            value={data.phone || 'Not added'}
            border
          />
          <InfoRow
            icon="shield-account-outline"
            label="Role"
            value={humanizeRole(data.role)}
            border={!!created}
          />
          {created ? (
            <InfoRow icon="calendar-outline" label="Member since" value={created} />
          ) : null}
        </View>

        <OrganizationCard org={org} loading={orgLoading} />

        <AppText style={styles.sectionTitle}>Manage</AppText>
        <View style={styles.card}>
          <ActionRow
            icon="lock-outline"
            label="Change Password"
            onPress={goToChangePassword}
          />
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.8}
          onPress={() => setConfirmLogout(true)}>
          <AppIcon name={ICONS.LOGOUT} size={moderateScale(20)} color={COLORS.danger} />
          <AppText style={styles.logoutText}>Logout</AppText>
        </TouchableOpacity>
      </>
    );
  };

  const renderBody = () => {
    if (profile) {
      return renderContent(profile);
    }
    if (loading) {
      return <ProfileSkeleton />;
    }
    return (
      <View style={styles.stateWrap}>
        <AppIcon name={ICONS.ACCOUNT_ALERT} size={moderateScale(48)} color={COLORS.gray500} />
        <AppText style={styles.stateTitle}>Couldn't load your profile</AppText>
        <AppText style={styles.stateMessage}>
          {error ?? GENERIC_ERROR_MESSAGE}
        </AppText>
        <Button
          title="Retry"
          onPress={onRefresh}
          fullWidth={false}
          style={styles.retryBtn}
        />
      </View>
    );
  };

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title="Profile"
        rightActions={profile ? ['edit'] : []}

        onActionPress={onHeaderAction}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        {renderBody()}
      </ScrollView>

      <Modal
        visible={confirmLogout}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmLogout(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <AppText style={styles.modalTitle}>Log out?</AppText>
            <AppText style={styles.modalMessage}>
              Are you sure you want to logout?
            </AppText>
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setConfirmLogout(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Logout"
                onPress={handleLogout}
                loading={loggingOut}
                style={styles.modalBtnDanger}
              />
            </View>
          </View>
        </View>
      </Modal>

      <ImagePickerBottomSheet
        visible={photoSheetVisible}
        onClose={() => setPhotoSheetVisible(false)}
        actions={photoSheetActions}
        title="Profile Photo"
      />

      {profile?.avatarUrl ? (
        <AppImageViewer
          images={[{ uri: profile.avatarUrl }]}
          imageIndex={0}
          visible={photoViewerVisible}
          onRequestClose={() => setPhotoViewerVisible(false)}
        />
      ) : null}
    </View>
  );
};

export default ProfileScreen;

const skStyles = StyleSheet.create({
  avatarSpacing: { marginBottom: spacing[4] },
});

const localStyles = StyleSheet.create({
  avatarWrap: { position: 'relative' },
  avatarEditBadge: {
    position: 'absolute',
    right: -scale(2),
    bottom: scale(2),
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: scale(48),
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
