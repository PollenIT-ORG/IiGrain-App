import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { AppIcon } from '../AppIcon';
import CenterActionButton from './CenterActionButton';
import AppText from '../AppText/AppText';
import { styles } from './CustomTabBarStyle';

const ICON_SIZE = moderateScale(22);
const ICON_SIZE_ACTIVE = moderateScale(25);

const ICONS: Record<string, [string, string]> = {
  Home: ['home-outline', 'home'],
  Assessment: ['clipboard-text-outline', 'clipboard-text'],
  Farms: ['sprout-outline', 'sprout'],
  More: ['dots-horizontal-circle-outline', 'dots-horizontal-circle'],
};

const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();

  // EnrollNow is a real tab route but has no tab button — the centre action
  // button owns it, so it carries the focused styling instead.
  const enrollFocused = state.routes[state.index]?.name === 'EnrollNow';

  const renderTab = (index: number) => {
    const route = state.routes[index];
    const { options } = descriptors[route.key];
    const label = (options.title ?? route.name) as string;
    const focused = state.index === index;
    const color = focused ? COLORS.primary : COLORS.gray700;
    const [inactiveIcon, activeIcon] = ICONS[route.name] ?? ['circle', 'circle'];

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <TouchableOpacity
        key={route.key}
        activeOpacity={0.7}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        style={styles.tab}>
        <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
          <AppIcon
            name={focused ? activeIcon : inactiveIcon}
            size={focused ? ICON_SIZE_ACTIVE : ICON_SIZE}
            color={color}
          />
        </View>
        <AppText
          style={[focused ? styles.labelActive : styles.label, { color }]}
          numberOfLines={1}>
          {label}
        </AppText>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {renderTab(0)}
        {renderTab(1)}
        <View style={styles.spacer} />
        {renderTab(2)}
        {renderTab(3)}
      </View>

      <View style={styles.fab}>
        <CenterActionButton
          active={enrollFocused}
          onPress={() => navigation.navigate('EnrollNow')}
        />
        <AppText
          style={[styles.fabLabel, enrollFocused && { color: COLORS.primary }]}
          numberOfLines={1}>
          Enroll Now
        </AppText>
      </View>
    </View>
  );
};

export default CustomTabBar;
