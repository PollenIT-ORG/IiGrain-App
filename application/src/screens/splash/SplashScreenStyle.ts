import { StyleSheet } from 'react-native';
import { COLORS, spacing } from '../../constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.white,
  },
  logo: {
    width: '100%',
    height: '100%',
    resizeMode:'cover',
  },
  brandWrap: {
    marginTop: spacing[6],
  },
});
