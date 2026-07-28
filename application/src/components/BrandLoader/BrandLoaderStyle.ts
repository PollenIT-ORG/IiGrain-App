import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { moderateScale } from '../../utils';

/** Bar geometry, shared with the component so the fill can be badge-aware. */
export const TRACK = {
  height: moderateScale(18),
  // Deep green at the start → bright leaf at the tip, matching the brand ramp.
  // Mutable on purpose: AppGradient takes a `string[]`, not a readonly tuple.
  fillColors: [
    COLORS.primaryDark,
    COLORS.primary,
    COLORS.leaf,
    '#A8DC4A',
  ] as string[],
};

/** Badge geometry — exported so callers can align other elements to it. */
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

  // Tall enough for the badge, which overhangs the track on both edges.
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
    // Clips the scaled fill to the pill.
    overflow: 'hidden',
  },

  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.full,
    // scaleX grows the fill from the left edge instead of from its centre.
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
    // The mark is transparent; this disc is what makes it legible.
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifts the badge off the track it rides.
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
