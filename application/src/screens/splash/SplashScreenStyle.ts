import { StyleSheet } from 'react-native';
import { spacing } from '../../constants';
import { SPLASH } from '../../config/splash';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    // Matches the native windowBackground, so the launch sequence never changes
    // colour underneath the user.
    backgroundColor: SPLASH.backgroundColor,
  },
  // Fills every aspect ratio edge to edge, so no letterbox bars appear on tall
  // phones or wide tablets.
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  // Sits in the deep-green band the artwork leaves free along the bottom.
  loader: {
    position: 'absolute',
    left: spacing[6],
    right: spacing[6],
    bottom: '12%',
  },
});
