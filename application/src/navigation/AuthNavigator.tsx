import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthenticationScreen from '../screens/auth/AuthenticationScreen';
import RoleScreen from '../screens/auth/RoleScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import type { AuthStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Authentication"
      screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Authentication" component={AuthenticationScreen} />
      <Stack.Screen name="Role" component={RoleScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
