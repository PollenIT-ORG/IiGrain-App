import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import AppGradient from '../AppGradient/AppGradient';
import AppText from '../AppText/AppText';
import { IMAGES } from '../../assets/images';
import { styles, BADGE, TRACK } from './BrandLoaderStyle';

export interface BrandLoaderProps {
  /** Caption above the bar. */
  label?: string;
  /** Caption colour — override when the loader sits on a dark surface. */
  labelColor?: string;
  /** How long the bar takes to travel 0 → 100%. */
  durationMs?: number;
  /** Fired once the bar reaches 100%. */
  onComplete?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Branded determinate progress bar: a green gradient fills the track while the
 * leaf badge rides its leading edge, so the mark advances with the fill instead
 * of waiting at the finish line.
 *
 * Both the fill (`scaleX`) and the badge (`translateX`) are driven off one
 * `Animated.Value` on the native driver, which keeps them locked together and
 * keeps the bar moving even while JS is busy with startup work — exactly when
 * this is on screen.
 */
const BrandLoader: React.FC<BrandLoaderProps> = ({
  label = 'Loading...',
  labelColor,
  durationMs = 5000,
  onComplete,
  style,
}) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  // Read through a ref so a fresh callback from the parent never restarts the
  // animation — a restart would visibly snap the bar back to 0.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setTrackWidth(prev => (prev === width ? prev : width));
  }, []);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      // Eases in and out so the bar starts and settles gently instead of
      // snapping at either end.
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        onCompleteRef.current?.();
      }
    });
    return () => animation.stop();
  }, [durationMs, progress]);

  const measured = trackWidth > 0;
  const halfBadge = BADGE.size / 2;

  // The badge travels between the track's ends, staying fully inside it.
  const badgeX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(trackWidth - BADGE.size, 0)],
  });

  // The fill stops under the badge's centre at every step, so its bright tip is
  // always exactly where the mark is — never running ahead of or behind it.
  const fillScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: measured
      ? [halfBadge / trackWidth, (trackWidth - halfBadge) / trackWidth]
      : [0, 0],
  });

  return (
    <View style={[styles.container, style]}>
      <AppText style={[styles.label, labelColor ? { color: labelColor } : null]}>
        {label}
      </AppText>

      <View style={styles.barRow} onLayout={handleTrackLayout}>
        <View style={styles.track}>
          {/* Scaled from the left edge so the gradient spans exactly the filled
              portion, deep green at the start and bright at the tip. */}
          <Animated.View
            style={[styles.fill, { transform: [{ scaleX: fillScale }] }]}>
            <AppGradient
              colors={TRACK.fillColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fillGradient}
            />
          </Animated.View>
        </View>

        {/* Opaque white disc: the mark itself is transparent, so it needs its
            own surface to read against the track and the page behind it. */}
        <Animated.View
          style={[styles.badge, { transform: [{ translateX: badgeX }] }]}>
          <Image
            source={IMAGES.logoMark}
            style={styles.badgeMark}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    </View>
  );
};

export default React.memo(BrandLoader);

export { BADGE as BRAND_LOADER_BADGE };
