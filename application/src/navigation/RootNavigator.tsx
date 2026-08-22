import React, { useEffect, useMemo, useState } from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashBackdrop from '../components/splash/SplashBackdrop';
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

  useProfileHydration();

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    dispatch(bootstrapThunk());
    const timer = setTimeout(() => setTimedOut(true), SPLASH.bootstrapTimeoutMs);
    return () => clearTimeout(timer);
  }, [dispatch]);

  const initialised = bootstrapped || timedOut;

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
        {!initialised ? (
          <Stack.Screen name="Booting" component={SplashBackdrop} />
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
