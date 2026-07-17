import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS } from '../../constants';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

let ringSeq = 0;

interface RegenScoreRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  gradientColors?: [string, string];
  duration?: number;
  children?: React.ReactNode;
}

const RegenScoreRing: React.FC<RegenScoreRingProps> = ({
  value,
  max = 100,
  size = 124,
  strokeWidth = 12,
  color,
  trackColor,
  gradientColors = [COLORS.leaf, color],
  duration = 1100,
  children,
}) => {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));

  const idRef = useRef<string>('');
  if (!idRef.current) {
    idRef.current = `regenRingGradient${ringSeq++}`;
  }
  const gradientId = idRef.current;

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, duration, pct]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, circumference * (1 - pct)],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.rotated}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradientColors[0]} />
            <Stop offset="1" stopColor={gradientColors[1]} />
          </LinearGradient>
        </Defs>

        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </Svg>

      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rotated: { transform: [{ rotate: '-90deg' }] },
  center: { alignItems: 'center', justifyContent: 'center' },
});

export default RegenScoreRing;
