import React, { useEffect } from 'react';
import { Image, StatusBar, View } from 'react-native';
import { IMAGES } from '../../assets/images';
import { styles } from './SplashScreenStyle';

const SPLASH_DURATION = 3000;

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(onFinish, SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Image source={IMAGES.splashLogo} style={styles.logo} fadeDuration={0} />
    </View>
  );
};

export default SplashScreen;
