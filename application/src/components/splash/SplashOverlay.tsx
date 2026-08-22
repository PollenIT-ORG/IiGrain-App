import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StatusBar, StyleSheet } from 'react-native';
import SplashScreen from '../../screens/splash/SplashScreen';
import SplashBackdrop from './SplashBackdrop';
import { SPLASH } from '../../config/splash';
import { useAppSelector } from '../../redux/hooks';
import { selectBootstrapped } from '../../redux/slices/authSlice';

type Stage = 'logo' | 'brand';

const SplashOverlay: React.FC = () => {
  const bootstrapped = useAppSelector(selectBootstrapped);

  const [stage, setStage] = useState<Stage>('logo');
  const [loaderDone, setLoaderDone] = useState(false);
  const [capReached, setCapReached] = useState(false);
  const [gone, setGone] = useState(false);

  const leafOpacity = useRef(new Animated.Value(1)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;

  const handleLoaderComplete = useCallback(() => setLoaderDone(true), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStage('brand');
      Animated.timing(leafOpacity, {
        toValue: 0,
        duration: SPLASH.fadeMs,
        useNativeDriver: true,
      }).start();
    }, SPLASH.logoMs);
    return () => clearTimeout(timer);
  }, [leafOpacity]);

  useEffect(() => {
    const timer = setTimeout(() => setCapReached(true), SPLASH.maxHoldMs);
    return () => clearTimeout(timer);
  }, []);

  const ready = loaderDone && (bootstrapped || capReached);
  useEffect(() => {
    if (!ready) return;
    const animation = Animated.timing(rootOpacity, {
      toValue: 0,
      duration: SPLASH.fadeMs,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setGone(true);
    });
    return () => animation.stop();
  }, [ready, rootOpacity]);

  if (gone) return null;

  return (
    <Animated.View style={[styles.root, { opacity: rootOpacity }]}>
      <StatusBar hidden />

      <SplashScreen
        showLoader={stage === 'brand'}
        onLoaderComplete={handleLoaderComplete}
      />

      <Animated.View
        style={[styles.leafLayer, { opacity: leafOpacity }]}
        pointerEvents="none">
        <SplashBackdrop />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH.backgroundColor,
    zIndex: 9999,
    elevation: 9999,
  },
  leafLayer: StyleSheet.absoluteFillObject,
});

export default React.memo(SplashOverlay);
