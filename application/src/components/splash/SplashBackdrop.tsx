import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { IMAGES } from '../../assets/images';
import { SPLASH } from '../../config/splash';

const SplashBackdrop: React.FC = () => (
  <View style={styles.container}>
    <Image source={IMAGES.splashLeaf} style={styles.leaf} resizeMode="contain" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH.backgroundColor,
  },
  leaf: {
    width: SPLASH.leafSize,
    height: SPLASH.leafSize,
  },
});

export default React.memo(SplashBackdrop);
