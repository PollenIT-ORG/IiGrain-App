import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { COLORS, presets, spacing } from '../../constants';
import AppText from '../AppText/AppText';

export interface TabItem<T extends string = string> {
  key: T;
  label: string;
}

interface AnimatedTabBarProps<T extends string> {
  tabs: TabItem<T>[];
  activeKey: T;
  onTabChange: (key: T) => void;
  style?: ViewStyle;
}

const TAB_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 };

const TabButton = memo(
  ({
    label,
    isActive,
    inactiveOpacity,
    activeOpacity,
    onPress,
  }: {
    label: string;
    isActive: boolean;
    inactiveOpacity: Animated.AnimatedInterpolation<number>;
    activeOpacity: Animated.AnimatedInterpolation<number>;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      hitSlop={TAB_HIT_SLOP}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={styles.tabButton}>
      <View style={styles.tabLabelContainer}>
        <Animated.View style={[styles.tabLabelLayer, { opacity: inactiveOpacity }]}>
          <AppText style={styles.tabLabelInactive}>{label}</AppText>
        </Animated.View>
        <Animated.View style={[styles.tabLabelLayer, styles.tabLabelOverlay, { opacity: activeOpacity }]}>
          <AppText style={styles.tabLabelActive}>{label}</AppText>
        </Animated.View>
      </View>
    </Pressable>
  ),
);

TabButton.displayName = 'TabButton';

function AnimatedTabBar<T extends string>({
  tabs,
  activeKey,
  onTabChange,
  style,
}: AnimatedTabBarProps<T>) {
  const [barWidth, setBarWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const activeIndex = useMemo(() => tabs.findIndex(t => t.key === activeKey), [tabs, activeKey]);
  const indicatorWidth = barWidth / tabs.length;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBarWidth(current => (current === w ? current : w));
  }, []);

  useEffect(() => {
    Animated.spring(progress, {
      toValue: activeIndex,
      stiffness: 220,
      damping: 24,
      mass: 0.9,
      overshootClamping: false,
      restDisplacementThreshold: 0.001,
      restSpeedThreshold: 0.001,
      useNativeDriver: true,
    }).start();
  }, [progress, activeIndex]);

  const translateX = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, Math.max(1, tabs.length - 1)],
        outputRange: [0, indicatorWidth * (tabs.length - 1)],
      }),
    [progress, indicatorWidth, tabs.length],
  );

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <View style={styles.tabRow}>
        {tabs.map((tab, index) => {
          const isActive = tab.key === activeKey;
          const distance = Animated.subtract(progress, index);
          const activeOpacity = distance.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0], extrapolate: 'clamp' });
          const inactiveOpacity = distance.interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 0, 1], extrapolate: 'clamp' });

          return (
            <TabButton
              key={tab.key}
              label={tab.label}
              isActive={isActive}
              activeOpacity={activeOpacity}
              inactiveOpacity={inactiveOpacity}
              onPress={() => onTabChange(tab.key)}
            />
          );
        })}
      </View>

      <View style={styles.divider} />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          {
            width: indicatorWidth,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

export default AnimatedTabBar;

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    marginTop: spacing[4],
    borderRadius: spacing[2],
  },
  tabRow: {
    flexDirection: 'row',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
  },
  tabLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabelLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabelOverlay: {
    position: 'absolute',
  },
  tabLabelInactive: {
    ...presets.labelLG,
    color: COLORS.gray700,
    textAlign: 'center',
  },
  tabLabelActive: {
    ...presets.labelLG,
    color: COLORS.primary,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray300,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: spacing[1],
    backgroundColor: COLORS.primary,
  },
});