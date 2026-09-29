import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  shadows,
  spacing,
} from '../../../constants';
import { addAlpha, moderateScale, scale } from '../../../utils';

const TILE = scale(44);

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[3.5],
    ...shadows.xs,
  },
  rowDone: {
    borderColor: COLORS.primaryLighter,
    backgroundColor: COLORS.lightPrimaryBg,
  },
  rowNext: {
    borderColor: COLORS.primary,
    borderWidth: borderWidth.medium,
    backgroundColor: COLORS.white,
    ...shadows.md,
  },
  rowPressed: {
    backgroundColor: COLORS.lightPrimary,
    transform: [{ scale: 0.995 }],
  },

  iconTile: {
    width: TILE,
    height: TILE,
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileDone: {
    backgroundColor: COLORS.primary,
  },
  stepBadge: {
    position: 'absolute',
    top: -scale(5),
    left: -scale(5),
    minWidth: scale(18),
    height: scale(18),
    paddingHorizontal: scale(3),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
  },
  stepBadgeDone: {
    borderColor: COLORS.primary,
  },
  stepBadgeText: {
    ...presets.labelSM,
    fontSize: moderateScale(10),
    lineHeight: moderateScale(13),
    color: COLORS.gray600,
  },
  stepBadgeTextDone: {
    color: COLORS.primary,
  },

  body: {
    flex: 1,
    gap: scale(2),
  },
  nextChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: scale(2),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.primary, 0.12),
    marginBottom: scale(2),
  },
  nextChipText: {
    ...presets.labelSM,
    fontSize: moderateScale(9),
    letterSpacing: 0.9,
    color: COLORS.primary,
  },
  title: {
    ...presets.bodyMD,
    fontFamily: fonts.semibold,
    color: COLORS.gray900,
  },
  subtitle: {
    ...presets.bodySM,
    color: COLORS.gray600,
  },

  tail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  chevron: {
    width: scale(28),
    height: scale(28),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  chevronNext: {
    backgroundColor: COLORS.primary,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: spacing[2.5],
    paddingVertical: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.primary, 0.12),
  },
  donePillText: {
    ...presets.labelSM,
    color: COLORS.primary,
  },
});
