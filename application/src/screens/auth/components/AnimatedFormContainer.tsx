import React, { ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { AuthMode } from '../../../components';

interface AnimatedFormContainerProps {
  authMode: AuthMode;
  login: ReactNode;
  signup: ReactNode;
}

const TIMING = { duration: 300, easing: Easing.out(Easing.cubic) };

const TRANSLATE = 16;
const SCALE_FROM = 0.98;

const AnimatedFormContainer: React.FC<AnimatedFormContainerProps> = ({
  authMode,
  login,
  signup,
}) => {
  const isLogin = authMode === 'login';
  const progress = useSharedValue(isLogin ? 0 : 1);

  useEffect(() => {
    progress.value = withTiming(isLogin ? 0 : 1, TIMING);
  }, [isLogin, progress]);

  const loginStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -TRANSLATE]) },
      { scale: interpolate(progress.value, [0, 1], [1, SCALE_FROM]) },
    ],
  }));

  const signupStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [TRANSLATE, 0]) },
      { scale: interpolate(progress.value, [0, 1], [SCALE_FROM, 1]) },
    ],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.layer, loginStyle]}
        pointerEvents={isLogin ? 'auto' : 'none'}>
        {login}
      </Animated.View>

      <Animated.View
        style={[styles.layer, signupStyle]}
        pointerEvents={isLogin ? 'none' : 'auto'}>
        {signup}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default React.memo(AnimatedFormContainer);
