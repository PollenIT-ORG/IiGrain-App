import { StyleSheet } from 'react-native';
import { spacing } from '../../constants';
import { SPLASH } from '../../config/splash';

export const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH.backgroundColor,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    left: spacing[6],
    right: spacing[6],
    bottom: '9%',
  },
});
