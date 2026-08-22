import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { moderateScale } from '../../utils';

export const TRACK = {
  height: moderateScale(18),
  fillColors: [
    COLORS.primaryDark,
    COLORS.primary,
    COLORS.leaf,
    '#A8DC4A',
  ] as string[],
};

export const BADGE = {
  size: moderateScale(44),
};

export const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  label: {
    ...presets.labelLG,
    color: COLORS.primary,
    marginBottom: spacing[2.5],
  },

  barRow: {
    width: '100%',
    height: BADGE.size,
    justifyContent: 'center',
  },

  track: {
    width: '100%',
    height: TRACK.height,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
    overflow: 'hidden',
  },

  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.full,
    transformOrigin: 'left',
  },
  fillGradient: {
    flex: 1,
    borderRadius: borderRadius.full,
  },

  badge: {
    position: 'absolute',
    left: 0,
    width: BADGE.size,
    height: BADGE.size,
    borderRadius: BADGE.size / 2,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeMark: {
    width: BADGE.size * 0.62,
    height: BADGE.size * 0.62,
  },
});
