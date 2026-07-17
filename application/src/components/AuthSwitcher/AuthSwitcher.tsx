import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { COLORS } from '../../constants';
import { styles, TRACK_PADDING } from './AuthSwitcherStyle';

export type AuthMode = 'login' | 'signup';

export interface AuthSwitcherProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
  style?: ViewStyle;
}

const TABS: { key: AuthMode; label: string }[] = [
  { key: 'login', label: 'Login' },
  { key: 'signup', label: 'Sign Up' },
];

const SPRING = { damping: 18, stiffness: 200, mass: 0.9 };

interface TabLabelProps {
  label: string;
  index: number;
  progress: SharedValue<number>;
  onPress: () => void;
  selected: boolean;
}

const TabLabel: React.FC<TabLabelProps> = ({
  label,
  index,
  progress,
  onPress,
  selected,
}) => {
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [index - 1, index, index + 1],
      [COLORS.gray500, COLORS.primary, COLORS.gray500],
    ),
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={styles.tab}>
      <Animated.Text style={[styles.tabText, textStyle]}>{label}</Animated.Text>
    </Pressable>
  );
};

const AuthSwitcher: React.FC<AuthSwitcherProps> = ({ mode, onChange, style }) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const tabWidth = trackWidth > 0 ? trackWidth / TABS.length : 0;

  const activeIndex = TABS.findIndex(t => t.key === mode);

  const progress = useDerivedValue(
    () => withSpring(activeIndex, SPRING),
    [activeIndex],
  );

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width - TRACK_PADDING * 2);
  };

  const pillStyle = useAnimatedStyle(() => ({
    width: tabWidth,
    transform: [{ translateX: progress.value * tabWidth }],
  }));

  return (
    <View style={[styles.container, style]} onLayout={onTrackLayout}>
      {tabWidth > 0 && <Animated.View style={[styles.pill, pillStyle]} />}

      {TABS.map((tab, index) => (
        <TabLabel
          key={tab.key}
          label={tab.label}
          index={index}
          progress={progress}
          selected={mode === tab.key}
          onPress={() => onChange(tab.key)}
        />
      ))}
    </View>
  );
};

export default AuthSwitcher;
