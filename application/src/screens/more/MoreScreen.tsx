import React, { useCallback } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText } from '../../components';
import { ProfileAvatar } from '../../components/account';
import { COLORS } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { useAppSelector } from '../../redux/hooks';
import { selectProfileIdentity } from '../../redux/selectors/profileSelectors';
import type { AppStackParamList } from '../../navigation/navigationTypes';
import { styles } from './MoreScreenStyle';

interface MenuItem {
  icon: string;
  label: string;
  target?: 'Account' | 'Profile' | 'Help' | 'OnboardingChecklist';
}

const MENU: MenuItem[] = [
  { icon: 'account-circle-outline', label: 'Profile', target: 'Profile' },
  { icon: 'account-outline', label: 'Account', target: 'Account' },
  { icon: ICONS.ROCKET, label: 'Getting Started', target: 'OnboardingChecklist' },
  { icon: 'help-circle-outline', label: 'Help' },
];

const MoreScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const identity = useAppSelector(selectProfileIdentity);

  const handlePress = useCallback(
    (item: MenuItem) => {
      if (item.target) {
        navigation.navigate(item.target);
      }
    },
    [navigation],
  );

  return (
    <View style={styles.safe}>
      <AppHeader variant="title" title="More" showDrawer />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <ProfileAvatar
            size={scale(56)}
            style={styles.avatar}
            imageStyle={styles.avatarImage}
            textStyle={styles.avatarText}
          />
          <View style={styles.flex}>
            <AppText style={styles.name} numberOfLines={1}>
              {identity.displayName}
            </AppText>
            {identity.email ? (
              <AppText style={styles.email} numberOfLines={1}>
                {identity.email}
              </AppText>
            ) : (
              <AppText style={styles.email} numberOfLines={1}>
                -
              </AppText>
            )}
            <View style={styles.roleBadge}>
              <AppText style={styles.roleText}>{identity.roleLabel}</AppText>
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
