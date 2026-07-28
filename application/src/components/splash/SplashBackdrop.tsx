import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { IMAGES } from '../../assets/images';
import { SPLASH } from '../../config/splash';

/**
 * What every pre-app layer paints while React Native is still coming up.
 *
 * It renders the *same* artwork as `SplashScreen`, not a flat colour: this is
 * what `PersistGate` shows while redux rehydrates, and a blank fill there reads
 * as a white screen wedged between the native icon splash and the real splash.
 * Painting the artwork instead makes the launch one continuous surface —
 * icon → artwork → artwork with the loader.
 */
const SplashBackdrop: React.FC = () => (
  <View style={styles.container}>
    <Image source={IMAGES.splashLogo} style={styles.image} resizeMode="cover" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Visible only in the instant before the artwork decodes, and matches the
    // native windowBackground so even that instant does not change colour.
    backgroundColor: SPLASH.backgroundColor,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});

export default React.memo(SplashBackdrop);
