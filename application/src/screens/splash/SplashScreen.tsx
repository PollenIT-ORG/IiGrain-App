import React from 'react';
import { Image, View } from 'react-native';
import { BrandLoader } from '../../components';
import { IMAGES } from '../../assets/images';
import { COLORS } from '../../constants';
import { SPLASH } from '../../config/splash';
import { styles } from './SplashScreenStyle';

export interface SplashScreenProps {
  
  showLoader?: boolean;
  onLoaderComplete?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({
  showLoader = false,
  onLoaderComplete,
}) => (
  <View style={styles.container}>
    <Image source={IMAGES.splashLogo} style={styles.image} resizeMode="cover" />

    {showLoader ? (
      <View style={styles.loader}>
        <BrandLoader
          durationMs={SPLASH.holdMs}
          labelColor={COLORS.white}
          onComplete={onLoaderComplete}
        />
      </View>
    ) : null}
  </View>
);

export default React.memo(SplashScreen);
