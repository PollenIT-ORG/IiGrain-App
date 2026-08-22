import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';

export interface MapCenterPinProps {
  lifted?: boolean;
  color?: string;
}

const PIN_WIDTH = 34;
const PIN_HEIGHT = 46;
const LIFT_DISTANCE = 8;
const LIFT_DURATION_MS = 120;

const MapCenterPin: React.FC<MapCenterPinProps> = ({ lifted = false, color = COLORS.primary }) => {
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(lift, {
      toValue: lifted ? 1 : 0,
      duration: LIFT_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [lifted, lift]);

  const translateY = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -LIFT_DISTANCE],
  });

  const width = moderateScale(PIN_WIDTH);
  const height = moderateScale(PIN_HEIGHT);

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.shadowDot} />
      <Animated.View
        style={[
          styles.pin,
          { transform: [{ translateY: -height / 2 }, { translateY }] },
        ]}>
        <Svg width={width} height={height} viewBox="0 0 24 32">
          <Path
            d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.37 18.63 0 12 0z"
            fill={color}
          />
          <Circle cx="12" cy="12" r="4.6" fill={COLORS.white} />
        </Svg>
      </Animated.View>
    </View>
  );
};

export default React.memo(MapCenterPin);

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    position: 'absolute',
  },
  shadowDot: {
    position: 'absolute',
    width: moderateScale(9),
    height: moderateScale(9),
    borderRadius: moderateScale(9) / 2,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
});
