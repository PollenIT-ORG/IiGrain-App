import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import AppGradient from '../AppGradient/AppGradient';
import { COLORS } from '../../constants';
import { scale } from '../../utils';
import type { GradientVariant } from '../../constants/gradients';

export interface AppProgressBarProps {
  percent: number;
  variant?: GradientVariant;
  height?: number;
  trackColor?: string;
  minVisiblePercent?: number;
  style?: StyleProp<ViewStyle>;
}

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
};

const AppProgressBar: React.FC<AppProgressBarProps> = ({
  percent,
  variant = 'progress',
  height = scale(8),
  trackColor = COLORS.gray200,
  minVisiblePercent = 4,
  style,
}) => {
  const [trackWidth, setTrackWidth] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setTrackWidth(prev => (prev === width ? prev : width));
  }, []);

  const value = clampPercent(percent);
  const shown = value > 0 ? Math.max(value, minVisiblePercent) : 0;
  const fillWidth = trackWidth > 0 ? (trackWidth * shown) / 100 : 0;
  const radius = height / 2;

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
      style={[
        styles.track,
        { height, borderRadius: radius, backgroundColor: trackColor },
        style,
      ]}>
      {fillWidth > 0 ? (
        <View style={[styles.clip, { width: fillWidth, borderRadius: radius }]}>
          <AppGradient
            variant={variant}
            style={{ width: trackWidth, height }}
          />
        </View>
      ) : null}
    </View>
  );
};

export default React.memo(AppProgressBar);

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  clip: {
    height: '100%',
    overflow: 'hidden',
  },
});
