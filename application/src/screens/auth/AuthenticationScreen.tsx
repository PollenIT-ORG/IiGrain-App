import React, { useCallback, useMemo, useState } from 'react';
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
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>(route.params?.mode ?? 'login');

  const handleSwitch = useCallback((next: AuthMode) => setAuthMode(next), []);
  const goSignup = useCallback(() => setAuthMode('signup'), []);
  const goLogin = useCallback(() => setAuthMode('login'), []);

  const loginForm = useMemo(() => <LoginForm />, []);
  const signupForm = useMemo(() => <SignupForm />, []);

  const isLogin = authMode === 'login';

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

      </SafeAreaView>
    </View>
  );
};

export default AuthenticationScreen;
