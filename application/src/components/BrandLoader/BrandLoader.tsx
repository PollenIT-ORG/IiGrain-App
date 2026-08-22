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
  label?: string;
  labelColor?: string;
  durationMs?: number;
  onComplete?: () => void;
  style?: StyleProp<ViewStyle>;
}

const BrandLoader: React.FC<BrandLoaderProps> = ({
  label = 'Loading...',
  labelColor,
  durationMs = 5000,
  onComplete,
  style,
}) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

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

  const badgeX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(trackWidth - BADGE.size, 0)],
  });

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
