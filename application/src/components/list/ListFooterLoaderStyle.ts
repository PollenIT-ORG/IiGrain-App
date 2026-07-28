import { StyleSheet } from 'react-native';
import { COLORS, presets, spacing } from '../../constants';

export const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  endText: {
    ...presets.caption,
    color: COLORS.gray500,
  },
});
