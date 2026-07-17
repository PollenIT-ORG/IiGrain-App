import { StyleSheet } from 'react-native';
import { COLORS, shadows } from '../../constants';
import { scale } from '../../utils';

const SIZE = scale(58);

export const styles = StyleSheet.create({
  outer: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: scale(3.5),
    borderColor: COLORS.white,
    overflow: 'hidden',
    ...shadows.lg,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
