import { StyleSheet } from 'react-native';
import { COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing, fonts } from '../../constants';
import { moderateScale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  center: {
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

  body: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },

  sectionHeader: {
    ...presets.headingXS,
    color: COLORS.gray700,
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },

  qCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
    gap: spacing[3],
    ...shadows.sm,
  },
  qCardPressed: {
    opacity: 0.85,
  },
  qText: {
    ...presets.bodyMD,
    color: COLORS.gray900,
    flex: 1,
  },
  qScoreBox: {
    alignItems: 'center',
    minWidth: moderateScale(64),
  },
  qScore: {
    fontSize: moderateScale(22),
    fontFamily: fonts.semibold,
    lineHeight: moderateScale(26),
  },
  qScoreLabel: {
    ...presets.caption,
    color: COLORS.gray500,
    marginTop: spacing[0.5],
    textAlign: 'center',
  },

  footer: {
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray200,
    backgroundColor: COLORS.white,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    gap: spacing[3.5],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedLabel: {
    ...presets.headingXS,
    color: COLORS.gray900,
  },
  completedCount: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  submitBtn: {
    marginTop: spacing[1],
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  lockNoteText: {
    ...presets.labelMD,
    color: COLORS.primary,
  },
});
