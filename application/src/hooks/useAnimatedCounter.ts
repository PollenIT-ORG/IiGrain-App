import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export const useAnimatedCounter = (value: number, duration = 1100): number => {
  const [display, setDisplay] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listenerId = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeListener(listenerId);
  }, [anim]);

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, value, duration]);

  return display;
};

export default useAnimatedCounter;
