/**
 * src/maps/components/MapCenterPin.tsx — the fixed centre pin used by the
 * location picker.
 *
 * WHY A CENTRE PIN AND NOT A DRAGGABLE MARKER
 * -------------------------------------------
 * A draggable `<Marker>` requires the user to hit a ~30 pt target with a finger
 * that then covers the very thing being positioned. The "move the map under a
 * fixed pin" pattern (Google Maps, Uber, every ride-hailing app) keeps the
 * target under the crosshair and the finger out of the way, and it means the
 * selected coordinate is simply the map centre — no marker state to keep in
 * sync with the camera.
 *
 * WHY IT IS AN RN VIEW, NOT A MAP CHILD
 * The pin does not move with the map, so it must not be a map child. It is an
 * absolutely-positioned sibling drawn on top, with `pointerEvents="none"` so
 * every touch falls through to the map beneath it.
 *
 * THE LIFT
 * While the map is moving the pin rises and a shadow dot stays on the ground.
 * That parallax is what tells the user the pin is hovering over a point rather
 * than being dragged across the surface — the same affordance the previous
 * Leaflet implementation had, kept so the interaction feels unchanged.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';

export interface MapCenterPinProps {
  /** `true` while the camera is in motion — lifts the pin off its shadow. */
  lifted?: boolean;
  /** Pin fill. Defaults to the brand primary. */
  color?: string;
}

const PIN_WIDTH = 34;
const PIN_HEIGHT = 46;
/** How far the pin rises while the map moves, in points. */
const LIFT_DISTANCE = 8;
const LIFT_DURATION_MS = 120;

const MapCenterPin: React.FC<MapCenterPinProps> = ({ lifted = false, color = COLORS.primary }) => {
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(lift, {
      toValue: lifted ? 1 : 0,
      duration: LIFT_DURATION_MS,
      easing: Easing.out(Easing.quad),
      // Transform-only animation → runs on the UI thread, so the lift stays
      // smooth even while JS is busy debouncing a reverse-geocode request.
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
      {/* Ground shadow: stays put so the lift is legible as height. */}
      <View style={styles.shadowDot} />
      <Animated.View
        style={[
          styles.pin,
          // Anchor the pin's TIP at the map centre: shift up by the full pin
          // height. Without this the pin's centre sits on the coordinate and
          // the tip points ~23 pt south of the place the user selected.
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
