import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText } from '../../components';
import { COLORS, borderRadius, borderWidth, presets, spacing, fonts } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { logoutThunk, selectAuthUser } from '../../redux/slices/authSlice';
import type { AssessorStackParamList } from '../../navigation/navigationTypes';

interface MenuItem {
  icon: string;
  label: string;
  target?: 'Profile' | 'Account' | 'EditProfile' | 'ChangePassword';
}

const MENU: MenuItem[] = [
  { icon: 'account-circle-outline', label: 'Profile', target: 'Profile' },
  { icon: 'account-outline', label: 'Account', target: 'Account' },
  { icon: 'account-edit-outline', label: 'Edit Profile', target: 'EditProfile' },
  { icon: 'lock-outline', label: 'Change Password', target: 'ChangePassword' },
  { icon: 'help-circle-outline', label: 'Help & Support' },
];

const AssessorMoreScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AssessorStackParamList>>();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);

  const handlePress = useCallback(
    (item: MenuItem) => {
      if (item.target) {
        navigation.navigate(item.target);
      }
    },
    [navigation],
  );

  const handleLogout = useCallback(() => dispatch(logoutThunk()), [dispatch]);

  const initials = (user?.fullName ?? 'A').trim().charAt(0).toUpperCase();

  return (
    <View style={styles.safe}>
      <AppHeader variant="title" title="More" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>{initials}</AppText>
          </View>
          <View style={styles.flex}>
            <AppText style={styles.name} numberOfLines={1}>{user?.fullName ?? 'Assessor'}</AppText>
            <AppText style={styles.email} numberOfLines={1}>{user?.email ?? ''}</AppText>
            <View style={styles.roleBadge}>
              <AppText style={styles.roleText}>Assessor</AppText>
            </View>
          </View>
        </View>

        <View style={styles.menu}>
          {MENU.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              activeOpacity={0.7}
              onPress={() => handlePress(item)}
              style={[styles.row, index < MENU.length - 1 && styles.rowBorder]}>
              <View style={styles.rowIcon}>
                <AppIcon name={item.icon} size={moderateScale(20)} color={COLORS.primary} />
              </View>
              <AppText style={styles.rowLabel}>{item.label}</AppText>
              <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(22)} color={COLORS.gray500} />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
};

export default AssessorMoreScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  body: { padding: spacing[4], paddingBottom: spacing[10] },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[5] },
  avatar: {
    width: scale(56), height: scale(56), borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.primary, 0.12), alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...presets.headingMD, color: COLORS.primary },
  name: { ...presets.headingSM, color: COLORS.gray900 },
  email: { ...presets.bodySM, color: COLORS.gray600 },
  roleBadge: {
    alignSelf: 'flex-start', marginTop: spacing[1], borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary, paddingHorizontal: spacing[2.5], paddingVertical: spacing[0.5],
  },
  roleText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.primaryDark },
  menu: {
    backgroundColor: COLORS.white, borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin, borderColor: COLORS.gray300, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3.5] },
  rowBorder: { borderBottomWidth: borderWidth.hairline, borderBottomColor: COLORS.gray300 },
  rowIcon: { width: scale(36), height: scale(36), borderRadius: borderRadius.md, backgroundColor: COLORS.lightPrimary, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...presets.labelMD, color: COLORS.gray900, flex: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    marginTop: spacing[6], paddingVertical: spacing[4],
    borderRadius: borderRadius.lg, borderWidth: borderWidth.thin, borderColor: COLORS.danger,
    backgroundColor: COLORS.white,
  },
  logoutText: { ...presets.labelLG, color: COLORS.danger },
});
