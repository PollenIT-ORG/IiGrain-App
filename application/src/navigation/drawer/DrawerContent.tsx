import React, { useCallback } from 'react';
import { TouchableOpacity, View } from 'react-native';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppText } from '../../components';
import { COLORS } from '../../constants';
import { capitalize, getInitials, moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { logoutThunk, selectAuthUser } from '../../redux/slices/authSlice';
import {
  drawerConfig,
  tabToModule,
  type DrawerItem,
} from '../../config/drawerConfig';
import type { AppTabParamList } from '../navigationTypes';
import { styles } from './DrawerContentStyle';

const APP_VERSION = '1.0.0';

const useActiveTab = (
  props: DrawerContentComponentProps,
): keyof AppTabParamList => {
  const main =
    props.state.routes.find(r => r.name === 'MainTabs') ??
    props.state.routes[props.state.index];
  const tabState = main?.state;
  const name = tabState?.routes?.[tabState.index ?? 0]?.name;
  return (name ?? 'Home') as keyof AppTabParamList;
};

const DrawerContent: React.FC<DrawerContentComponentProps> = props => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectAuthUser);
  const activeTab = useActiveTab(props);
  const module = drawerConfig[tabToModule[activeTab]];

  const { navigation } = props;
  const displayName = user?.fullName?.trim() || 'Farmer';
  const email = user?.email ?? '';
  const initials = getInitials(displayName) || 'F';
  const roleLabel = capitalize((user?.role ?? '').trim()) || 'Farmer';

  const goStackRoute = useCallback(
    (route: string) => {
      navigation.getParent()?.navigate(route as never);
      navigation.closeDrawer();
    },
    [navigation],
  );

  const goProfile = useCallback(() => goStackRoute('Profile'), [goStackRoute]);

  const onItemPress = useCallback(
    (item: DrawerItem) => {
      if (item.tab) {
        navigation.navigate('MainTabs', { screen: item.tab });
        navigation.closeDrawer();
      } else if (item.route) {
        goStackRoute(item.route);
      } else {
        navigation.closeDrawer();
      }
    },
    [navigation, goStackRoute],
  );

  const onSignOut = useCallback(() => {
    navigation.closeDrawer();
    dispatch(logoutThunk());
  }, [navigation, dispatch]);

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={styles.profile}
          activeOpacity={0.8}
          onPress={goProfile}
          accessibilityRole="button"
          accessibilityLabel="Open profile">
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>{initials}</AppText>
          </View>
          <View style={styles.profileTexts}>
            <AppText style={styles.name} numberOfLines={1}>
              {displayName}
            </AppText>
            {email ? (
              <AppText style={styles.email} numberOfLines={1}>
                {email}
              </AppText>
            ) : null}
            <View style={styles.rolePill}>
              <AppText style={styles.roleText}>{roleLabel}</AppText>
            </View>
          </View>
          <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(22)} color={COLORS.gray500} />
        </TouchableOpacity>

        <AppText style={styles.sectionLabel}>{module.title}</AppText>

        <View style={styles.items}>
          {module.items.map(item => {
            const active = !!item.tab && item.tab === activeTab;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.75}
                onPress={() => onItemPress(item)}
                style={[styles.item, active && styles.itemActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}>
                <View style={[styles.itemIcon, active && styles.itemIconActive]}>
                  <AppIcon
                    name={item.icon}
                    size={moderateScale(20)}
                    color={active ? COLORS.primary : COLORS.gray600}
                  />
                </View>
                <AppText
                  style={[styles.itemLabel, active && styles.itemLabelActive]}
                  numberOfLines={1}>
                  {item.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>
      </DrawerContentScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + moderateScale(12) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onSignOut}
          style={styles.signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out">
          <AppIcon name={ICONS.LOGOUT} size={moderateScale(20)} color={COLORS.danger} />
          <AppText style={styles.signOutText}>Sign Out</AppText>
        </TouchableOpacity>
        <AppText style={styles.version}>iiGrain • v{APP_VERSION}</AppText>
      </View>
    </View>
  );
};

export default DrawerContent;
