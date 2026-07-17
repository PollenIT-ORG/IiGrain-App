import React, { useCallback } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText } from '../../components';
import { COLORS } from '../../constants';
import { capitalize, moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { logoutThunk, selectAuthUser } from '../../redux/slices/authSlice';
import type { AppStackParamList } from '../../navigation/navigationTypes';
import { styles } from './MoreScreenStyle';

interface MenuItem {
  icon: string;
  label: string;
  target?: 'Account' | 'Profile';
}

const MENU: MenuItem[] = [
  { icon: 'account-circle-outline', label: 'Profile', target: 'Profile' },
  { icon: 'account-outline', label: 'Account', target: 'Account' },
  { icon: 'cog-outline', label: 'Settings' },
  { icon: 'help-circle-outline', label: 'Help' },
];

const MoreScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
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

  const handleLogout = useCallback(() => {
    dispatch(logoutThunk());
  }, [dispatch]);

  const initials = (user?.fullName ?? 'F').trim().charAt(0).toUpperCase();
  const roleLabel = capitalize(user?.role ?? '') || 'Farmer';

  return (
    <View style={styles.safe}>
      <AppHeader variant="title" title="More" showDrawer />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>{initials}</AppText>
          </View>
          <View style={styles.flex}>
            <AppText style={styles.name} numberOfLines={1}>{user?.fullName ?? 'Farmer'}</AppText>
            <AppText style={styles.email} numberOfLines={1}>{user?.email ?? ''}</AppText>
            <View style={styles.roleBadge}>
              <AppText style={styles.roleText}>{roleLabel}</AppText>
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

export default MoreScreen;
