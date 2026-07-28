import { StyleSheet } from 'react-native';
import { borderRadius, COLORS, presets, spacing } from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: scale(44),
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.gray100,
  },
  input: {
    flex: 1,
    ...presets.bodySM,
    color: COLORS.gray900,
    padding: 0,
  },
});
