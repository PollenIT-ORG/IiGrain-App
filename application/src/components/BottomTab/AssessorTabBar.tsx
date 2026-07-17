import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { AppIcon } from '../AppIcon';
import AppText from '../AppText/AppText';
import { styles } from './CustomTabBarStyle';

const ICON_SIZE = moderateScale(22);
const ICON_SIZE_ACTIVE = moderateScale(25);

const ICONS: Record<string, [string, string]> = {
  AssessorHome: ['view-dashboard-outline', 'view-dashboard'],
  AssessorFarmers: ['account-group-outline', 'account-group'],
  AssessorHistory: ['history', 'history'],
  AssessorMore: ['dots-horizontal-circle-outline', 'dots-horizontal-circle'],
};

const LABELS: Record<string, string> = {
  AssessorHome: 'Home',
  AssessorFarmers: 'Farmers',
  AssessorHistory: 'History',
  AssessorMore: 'More',
};

const AssessorTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
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
                {LABELS[route.name] ?? route.name}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default AssessorTabBar;
