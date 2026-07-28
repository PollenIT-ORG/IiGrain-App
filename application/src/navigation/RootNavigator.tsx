import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/splash/SplashScreen';
import { SPLASH } from '../config/splash';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import {
  bootstrapThunk,
  selectAuthStatus,
  selectBootstrapped,
} from '../redux/slices/authSlice';
import { navigationRef } from '../services/navigationRef';
import { useProfileHydration } from '../hooks/useProfileHydration';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';

const Stack = createNativeStackNavigator();

const RootNavigator: React.FC = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAuthStatus);
  const bootstrapped = useAppSelector(selectBootstrapped);

  // Mounted at the root so the profile hydrates from authentication alone,
  // independent of which screen is rendered. It no-ops until authenticated.
  useProfileHydration();

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    dispatch(bootstrapThunk());
    const timer = setTimeout(() => setTimedOut(true), 7000);
    return () => clearTimeout(timer);
  }, [dispatch]);

  // Startup work runs while the video plays, so the two finish independently:
  //  - initialisation first → hold the splash until the video ends
  //  - video first          → the splash shows a loader until startup lands
  // Leaving requires both, which is what keeps the app from opening half-built.
  const initialised = bootstrapped || timedOut;
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);
  const ready = initialised && splashDone;

  // Stable identity: a fresh callback each render would reconcile the splash
  // subtree and restart its loader.
  const renderSplash = useCallback(
    () => <SplashScreen onFinish={handleSplashFinish} initializing={!initialised} />,
    [handleSplashFinish, initialised],
  );

  // React Navigation's default theme paints its own light-grey background, and
  // the native stack paints each scene with it. Both sit above the splash while
  // navigation mounts, so leaving them at the default puts a pale flash between
  // the splash artwork and the first screen. Pin both to the splash colour.
  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: { ...DefaultTheme.colors, background: SPLASH.backgroundColor },
    }),
    [],
  );
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: SPLASH.backgroundColor },
    }),
    [],
  );

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={screenOptions}>
        {!ready ? (
          <Stack.Screen name="Splash">{renderSplash}</Stack.Screen>
        ) : status === 'authenticated' ? (
          <Stack.Screen name="App" component={AppNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
