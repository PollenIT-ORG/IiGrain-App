import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { COLORS, presets, spacing } from '../../constants';
import { scale } from '../../utils';
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
  scrollable?: boolean;
}

const TAB_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 };

const TabButton = memo(
  ({
    label,
    isActive,
    inactiveOpacity,
    activeOpacity,
    onPress,
    onLayout,
    scrollable,
  }: {
    label: string;
    isActive: boolean;
    inactiveOpacity: Animated.AnimatedInterpolation<number>;
    activeOpacity: Animated.AnimatedInterpolation<number>;
    onPress: () => void;
    onLayout?: (e: LayoutChangeEvent) => void;
    scrollable?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      hitSlop={TAB_HIT_SLOP}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={scrollable ? styles.tabButtonScrollable : styles.tabButton}>
      <View style={styles.tabLabelContainer}>
        <Animated.View style={[styles.tabLabelLayer, { opacity: inactiveOpacity }]}>
          <AppText style={styles.tabLabelInactive} numberOfLines={1}>
            {label}
          </AppText>
        </Animated.View>
        <Animated.View
          style={[styles.tabLabelLayer, styles.tabLabelOverlay, { opacity: activeOpacity }]}>
          <AppText style={styles.tabLabelActive} numberOfLines={1}>
            {label}
          </AppText>
        </Animated.View>
      </View>
    </Pressable>
  ),
);

TabButton.displayName = 'TabButton';

interface TabMetrics {
  x: number;
  width: number;
}

function AnimatedTabBar<T extends string>({
  tabs,
  activeKey,
  onTabChange,
  style,
  scrollable = false,
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
      toValue: activeIndex < 0 ? 0 : activeIndex,
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

  const labelOpacities = useMemo(
    () =>
      tabs.map((_, index) => {
        const distance = Animated.subtract(progress, index);
        return {
          active: distance.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp' as const,
          }),
          inactive: distance.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [1, 0, 1],
            extrapolate: 'clamp' as const,
          }),
        };
      }),
    [progress, tabs],
  );

  const scrollRef = useRef<ScrollView>(null);
  const [metrics, setMetrics] = useState<Record<number, TabMetrics>>({});
  const [viewportWidth, setViewportWidth] = useState(0);
  const contentWidth = useRef(0);

  const tabsKey = tabs.map(t => t.key).join('|');
  useEffect(() => {
    setMetrics({});
  }, [tabsKey]);

  const measureTab = useCallback((index: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setMetrics(current => {
      const existing = current[index];
      if (existing && existing.x === x && existing.width === width) {
        return current;
      }
      return { ...current, [index]: { x, width } };
    });
  }, []);

  const measured = scrollable && tabs.every((_, i) => metrics[i]?.width > 0);

  const scrollIndicator = useMemo(() => {
    if (!measured || tabs.length === 0) {
      return null;
    }
    const base = metrics[0].width;
    if (base <= 0) {
      return null;
    }
    const centres = tabs.map((_, i) => metrics[i].x + metrics[i].width / 2 - base / 2);
    const scales = tabs.map((_, i) => metrics[i].width / base);

    if (tabs.length === 1) {
      return {
        width: base,
        transform: [{ translateX: centres[0] }, { scaleX: scales[0] }],
      };
    }

    const inputRange = tabs.map((_, i) => i);
    return {
      width: base,
      transform: [
        {
          translateX: progress.interpolate({
            inputRange,
            outputRange: centres,
            extrapolate: 'clamp' as const,
          }),
        },
        {
          scaleX: progress.interpolate({
            inputRange,
            outputRange: scales,
            extrapolate: 'clamp' as const,
          }),
        },
      ],
    };
  }, [measured, metrics, progress, tabs]);

  useEffect(() => {
    if (!scrollable || activeIndex < 0 || !viewportWidth) {
      return;
    }
    const tab = metrics[activeIndex];
    if (!tab) {
      return;
    }
    const centre = tab.x + tab.width / 2 - viewportWidth / 2;
    const maxScroll = Math.max(0, contentWidth.current - viewportWidth);
    scrollRef.current?.scrollTo({
      x: Math.min(Math.max(0, centre), maxScroll),
      animated: true,
    });
  }, [scrollable, activeIndex, metrics, viewportWidth]);

  if (scrollable) {
    return (
      <View style={[styles.container, style]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={e => setViewportWidth(e.nativeEvent.layout.width)}
          onContentSizeChange={w => {
            contentWidth.current = w;
          }}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.scrollInner}>
            <View style={styles.tabRow}>
              {tabs.map((tab, index) => (
                <TabButton
                  key={tab.key}
                  label={tab.label}
                  scrollable
                  isActive={tab.key === activeKey}
                  activeOpacity={labelOpacities[index].active}
                  inactiveOpacity={labelOpacities[index].inactive}
                  onPress={() => onTabChange(tab.key)}
                  onLayout={e => measureTab(index, e)}
                />
              ))}
            </View>

            <View style={styles.divider} />
            {scrollIndicator ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.indicator, scrollIndicator]}
              />
            ) : null}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <View style={styles.tabRow}>
        {tabs.map((tab, index) => (
          <TabButton
            key={tab.key}
            label={tab.label}
            isActive={tab.key === activeKey}
            activeOpacity={labelOpacities[index].active}
            inactiveOpacity={labelOpacities[index].inactive}
            onPress={() => onTabChange(tab.key)}
          />
        ))}
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
  scrollContent: {
    flexGrow: 1,
  },
  scrollInner: {
    flexGrow: 1,
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
  tabButtonScrollable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: scale(14),
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
