import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: spacing[2],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  box: {
    width: scale(46),
    height: scale(56),
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  boxActive: {
    borderColor: COLORS.primary,
    borderWidth: borderWidth.medium,
    backgroundColor: COLORS.white,
  },
  boxError: {
    borderColor: COLORS.danger,
  },
  boxText: {
    ...presets.headingLG,
    color: COLORS.gray900,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
