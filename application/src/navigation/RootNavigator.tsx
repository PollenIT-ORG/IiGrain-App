import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/splash/SplashScreen';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import {
  bootstrapThunk,
  selectAuthStatus,
  selectBootstrapped,
} from '../redux/slices/authSlice';
import { navigationRef } from '../services/navigationRef';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';

const Stack = createNativeStackNavigator();

const noop = () => {};

const RootNavigator: React.FC = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAuthStatus);
  const bootstrapped = useAppSelector(selectBootstrapped);

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    dispatch(bootstrapThunk());
    const timer = setTimeout(() => setTimedOut(true), 7000);
    return () => clearTimeout(timer);
  }, [dispatch]);

  const ready = bootstrapped || timedOut;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!ready ? (
          <Stack.Screen name="Splash">
            {() => <SplashScreen onFinish={noop} />}
          </Stack.Screen>
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
