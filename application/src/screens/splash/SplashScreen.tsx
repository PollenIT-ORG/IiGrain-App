import React from 'react';
import { Image, StatusBar, View } from 'react-native';
import { BrandLoader } from '../../components';
import { IMAGES } from '../../assets/images';
import { COLORS } from '../../constants';
import { SPLASH } from '../../config/splash';
import { styles } from './SplashScreenStyle';

interface SplashScreenProps {
  /** Called once the loader has filled. Fires exactly once. */
  onFinish: () => void;
  /** True while startup work is still running. */
  initializing?: boolean;
}

/**
 * Launch screen: the branded artwork edge to edge with the loader bar running
 * across the dark band it leaves free at the bottom. The bar filling is what
 * hands control back — see `RootNavigator`, which only leaves the splash when
 * the loader AND initialisation have both finished.
 */
const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => (
  <View style={styles.container}>
    {/* Full-bleed artwork: no status bar competing with it. */}
    <StatusBar hidden />
    <Image source={IMAGES.splashLogo} style={styles.image} resizeMode="cover" />

    <View style={styles.loader}>
      {/* White caption: this band of the artwork is deep green. */}
      <BrandLoader
        durationMs={SPLASH.holdMs}
        labelColor={COLORS.white}
        onComplete={onFinish}
      />
    </View>
  </View>
);

export default SplashScreen;
