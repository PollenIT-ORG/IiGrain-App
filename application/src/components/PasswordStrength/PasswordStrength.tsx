import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon } from '../AppIcon';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import AppText from '../AppText/AppText';
import {
  calculatePasswordStrength,
  PasswordRules,
  PasswordStrength as Strength,
} from './PasswordStrengthUtils';
import { styles } from './PasswordStrengthStyle';

export interface PasswordStrengthProps {
  password: string;
}

const TIMING = { duration: 200, easing: Easing.out(Easing.cubic) };

const STRENGTH_COLOR: Record<Strength, string> = {
  weak: COLORS.danger,
  fair: COLORS.accent,
  good: COLORS.warning,
  strong: COLORS.primary,
};

const COLOR_INPUT = [2, 3, 4, 5];
const COLOR_OUTPUT = [
  COLORS.danger,
  COLORS.accent,
  COLORS.warning,
  COLORS.primary,
];

const CHECKLIST: { key: keyof PasswordRules; label: string }[] = [
  { key: 'minLength', label: 'Minimum 8 characters' },
  { key: 'uppercase', label: 'One uppercase letter' },
  { key: 'lowercase', label: 'One lowercase letter' },
  { key: 'number', label: 'One number' },
  { key: 'special', label: 'One special character' },
];

interface ChecklistRowProps {
  label: string;
  met: boolean;
}

const ChecklistRow: React.FC<ChecklistRowProps> = React.memo(({ label, met }) => (
  <View style={styles.checkRow}>
    <AppIcon
      name={met ? 'check-circle' : 'circle-outline'}
      size={moderateScale(16)}
      color={met ? COLORS.success : COLORS.gray500}
      accessibilityLabel={`${label}: ${met ? 'met' : 'not met'}`}
    />
    <AppText style={[styles.checkText, met && styles.checkTextMet]}>{label}</AppText>
  </View>
));
ChecklistRow.displayName = 'ChecklistRow';

const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  const result = useMemo(() => calculatePasswordStrength(password), [password]);

  const score = useSharedValue(result.score);
  useEffect(() => {
    score.value = withTiming(result.score, TIMING);
  }, [result.score, score]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${interpolate(score.value, [0, 5], [0, 100])}%`,
    backgroundColor: interpolateColor(score.value, COLOR_INPUT, COLOR_OUTPUT),
  }));

  if (!password) {
    return null;
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>

      <AppText
        style={styles.label}
        color={STRENGTH_COLOR[result.strength]}
        accessibilityLabel={`Password strength: ${result.label}`}>
        {result.label}
      </AppText>

      <View style={styles.checklist}>
        {CHECKLIST.map(item => (
          <ChecklistRow key={item.key} label={item.label} met={result.rules[item.key]} />
        ))}
      </View>
    </Animated.View>
  );
};

export default React.memo(PasswordStrength);
