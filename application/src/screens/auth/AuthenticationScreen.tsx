import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStatusBar, AppText, AuthHeader, AuthSwitcher } from '../../components';
import type { AuthMode } from '../../components';
import type { AuthScreenProps } from '../../navigation/navigationTypes';
import AnimatedFormContainer from './components/AnimatedFormContainer';
import LoginForm from './components/LoginForm';
import SignupForm from './components/SignupForm';
import { styles } from './AuthenticationScreenStyle';

const AuthenticationScreen: React.FC<AuthScreenProps<'Authentication'>> = ({
  route,
  navigation,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>(route.params?.mode ?? 'login');

  const paramMode = route.params?.mode;
  const paramError = route.params?.enrollmentError;
  useEffect(() => {
    if (paramMode) {
      setAuthMode(paramMode);
    }
  }, [paramMode, paramError]);

  const handleSwitch = useCallback((next: AuthMode) => setAuthMode(next), []);

  const loginForm = useMemo(() => <LoginForm />, []);
  const signupForm = useMemo(() => <SignupForm />, []);

  return (
    <View style={styles.safe}>
      <AppStatusBar />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.top}>
        <AuthHeader
          showLogo
          subtitle="The Only Farmer Inspection Platform Built for Growth."
        />
        <AuthSwitcher mode={authMode} onChange={handleSwitch} />
      </View>

      <AnimatedFormContainer
        authMode={authMode}
        login={loginForm}
        signup={signupForm}
      />

      <View style={styles.footer}>
        <AppText style={styles.footerPrompt}>Trouble signing in? </AppText>
        <TouchableOpacity
          onPress={() => navigation.navigate('Help')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Help and support">
          <AppText style={styles.footerAction}>Get help</AppText>
        </TouchableOpacity>
      </View>

      </SafeAreaView>
    </View>
  );
};

export default AuthenticationScreen;
