import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const EASE = Easing.inOut(Easing.ease);

export interface FarmerSceneProps {
  sky?: ImageSourcePropType;
  clouds?: ImageSourcePropType;
  field?: ImageSourcePropType;
  plants?: ImageSourcePropType;
  farmer?: ImageSourcePropType;
  hat?: ImageSourcePropType;
  shovel?: ImageSourcePropType;
  bushes?: ImageSourcePropType;
  aspectRatio?: number;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}

const FarmerScene: React.FC<FarmerSceneProps> = ({
  sky,
  clouds,
  field,
  plants,
  farmer,
  hat,
  shovel,
  bushes,
  aspectRatio = 1.5,
  animate = true,
  style,
}) => {
  const cloudX = useSharedValue(0);
  const plantRot = useSharedValue(0);
  const bodyY = useSharedValue(0);
  const bodyRot = useSharedValue(0);
  const hatY = useSharedValue(0);
  const shovelRot = useSharedValue(0);
  const bushScale = useSharedValue(1);
  const bushY = useSharedValue(0);

  useEffect(() => {
    const loop = (
      sv: SharedValue<number>,
      to: number,
      duration: number,
      delay = 0,
    ) => {
      sv.value = withDelay(
        delay,
        withRepeat(withTiming(to, { duration, easing: EASE }), -1, true),
      );
    };

    if (animate) {
      loop(cloudX, 10, 14000);
      loop(plantRot, 1.4, 2600, 300);
      loop(bodyY, -3, 3200);
      loop(bodyRot, 0.7, 5200, 400);
      loop(hatY, -2, 3400, 150);
      loop(shovelRot, 1, 3800, 500);
      loop(bushScale, 0.985, 3000, 200);
      loop(bushY, 2, 3000, 200);
    } else {
      cloudX.value = 0;
      plantRot.value = 0;
      bodyY.value = 0;
      bodyRot.value = 0;
      hatY.value = 0;
      shovelRot.value = 0;
      bushScale.value = 1;
      bushY.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  const cloudStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cloudX.value }],
  }));
  const plantStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${plantRot.value}deg` }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bodyY.value }, { rotate: `${bodyRot.value}deg` }],
  }));
  const hatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bodyY.value + hatY.value },
      { rotate: `${bodyRot.value}deg` },
    ],
  }));
  const shovelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bodyY.value }, { rotate: `${shovelRot.value}deg` }],
  }));
  const bushStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bushY.value }, { scale: bushScale.value }],
  }));

  return (
    <View style={[styles.scene, { aspectRatio }, style]} pointerEvents="none">
      {sky ? <Animated.Image source={sky} style={styles.layer} resizeMode="contain" /> : null}
      {clouds ? (
        <Animated.Image source={clouds} style={[styles.layer, cloudStyle]} resizeMode="contain" />
      ) : null}
      {field ? <Animated.Image source={field} style={styles.layer} resizeMode="contain" /> : null}
      {plants ? (
        <Animated.Image source={plants} style={[styles.layer, plantStyle]} resizeMode="contain" />
      ) : null}
      {farmer ? (
        <Animated.Image source={farmer} style={[styles.layer, bodyStyle]} resizeMode="contain" />
      ) : null}
      {shovel ? (
        <Animated.Image source={shovel} style={[styles.layer, shovelStyle]} resizeMode="contain" />
      ) : null}
      {hat ? (
        <Animated.Image source={hat} style={[styles.layer, hatStyle]} resizeMode="contain" />
      ) : null}
      {bushes ? (
        <Animated.Image source={bushes} style={[styles.layer, bushStyle]} resizeMode="contain" />
      ) : null}
    </View>
  );
};

export default React.memo(FarmerScene);

const styles = StyleSheet.create({
  scene: {
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
