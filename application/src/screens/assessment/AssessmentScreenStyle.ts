import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  tabBar: {
    marginHorizontal: spacing[4],
    backgroundColor: COLORS.white,
  },
  body: {
    padding: spacing[4],
    /**
     * Clears the bottom tab bar AND the centre "Enroll" button, which
     * CustomTabBar positions absolutely at `top: -22` — i.e. it floats ABOVE the
     * bar and overlapped the last card once the list was scrolled to the end.
     * The tab-bar height alone was not enough; this adds ~60px on top of it.
     */
    paddingBottom: spacing[24] + scale(60),
    gap: spacing[4],
  },
  searchWrap: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
  listHeader: {
    gap: spacing[4],
    paddingBottom: spacing[4],
  },
  listFlex: {
    flex: 1,
    paddingBottom: spacing[5],
  },
  section: {
    gap: spacing[3],
  },
  categoriesCard: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.medium,
    borderColor: COLORS.gray300,
    paddingHorizontal: spacing[4],
    ...shadows.sm,
  },

  fieldCaption: {
    ...presets.bodySM,
    color: COLORS.gray700,
  },

  stateCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  stateTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
    marginTop: spacing[4],
    textAlign: 'center',
  },
  stateMessage: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginTop: spacing[2],
    marginBottom: spacing[6],
    textAlign: 'center',
  },
  retryBtn: {
    minWidth: moderateScale(160),
  },

  landingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  landingTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
    flex: 1,
  },
  landingCount: {
    ...presets.bodyXS,
    color: COLORS.gray700,
  },
  countsRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  countChip: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[0.5],
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    ...shadows.sm,
  },
  countValue: {
    ...presets.headingMD,
  },
  countLabel: {
    ...presets.caption,
    color: COLORS.gray700,
    textAlign: 'center',
  },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    alignSelf: 'flex-start',
    paddingVertical: spacing[1],
  },
  backText: {
    ...presets.labelMD,
    color: COLORS.primary,
  },
});
