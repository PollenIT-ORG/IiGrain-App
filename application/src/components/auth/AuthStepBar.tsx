import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon, ICONS } from '../AppIcon';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import AppText from '../AppText/AppText';
import { styles } from './AuthStepBarStyle';

export interface AuthStepBarProps {
  steps: readonly string[];
  current: number;
}

const TIMING = { duration: 260, easing: Easing.out(Easing.cubic) };

interface StepConnectorProps {
  filled: boolean;
}

const StepConnector: React.FC<StepConnectorProps> = React.memo(({ filled }) => {
  const progress = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(filled ? 1 : 0, TIMING);
  }, [filled, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.connector}>
      <Animated.View style={[styles.connectorFill, fillStyle]} />
    </View>
  );
});
StepConnector.displayName = 'StepConnector';

interface StepDotProps {
  index: number;
  label: string;
  state: 'done' | 'active' | 'upcoming';
}

const StepDot: React.FC<StepDotProps> = React.memo(({ index, label, state }) => {
  const done = state === 'done';
  const active = state === 'active';

  return (
    <View style={styles.step}>
      <View
        style={[
          styles.dot,
          done && styles.dotDone,
          active && styles.dotActive,
        ]}
        accessibilityRole="text"
        accessibilityLabel={`Step ${index + 1} of 3, ${label}, ${state}`}>
        {done ? (
          <AppIcon
            name={ICONS.CHECK_BOLD}
            size={moderateScale(13)}
            color={COLORS.white}
          />
        ) : (
          <AppText style={[styles.dotText, active && styles.dotTextActive]}>
            {index + 1}
          </AppText>
        )}
      </View>

      <AppText
        numberOfLines={1}
        style={[styles.label, (done || active) && styles.labelOn]}>
        {label}
      </AppText>
    </View>
  );
});
StepDot.displayName = 'StepDot';

const AuthStepBar: React.FC<AuthStepBarProps> = ({ steps, current }) => (
  <View style={styles.container} accessibilityRole="progressbar">
    <View style={styles.row}>
      {steps.map((label, index) => {
        const position = index + 1;
        const state =
          position < current ? 'done' : position === current ? 'active' : 'upcoming';
        return (
          <React.Fragment key={label}>
            {index > 0 ? <StepConnector filled={position <= current} /> : null}
            <StepDot index={index} label={label} state={state} />
          </React.Fragment>
        );
      })}
    </View>
  </View>
);

export default React.memo(AuthStepBar);
