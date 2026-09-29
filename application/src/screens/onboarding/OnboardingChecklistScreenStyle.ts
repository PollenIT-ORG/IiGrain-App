import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  body: {
    flexGrow: 1,
    padding: spacing[5],
  },
  backButton: {
    position: 'absolute',
    left: spacing[5],
    width: scale(40),
    height: scale(40),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.sm,
  },
  backPressed: {
    backgroundColor: COLORS.gray100,
  },

  title: {
    ...presets.headingXL,
    color: COLORS.gray900,
  },
  subtitle: {
    ...presets.bodyMD,
    color: COLORS.gray600,
    marginTop: spacing[2],
  },

  progressCard: {
    marginTop: spacing[5],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.xs,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  progressTexts: {
    flex: 1,
    gap: scale(2),
  },
  progressTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  progressText: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  percentPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.gray100,
  },
  percentPillDone: {
    backgroundColor: COLORS.lightPrimary,
  },
  percentText: {
    ...presets.headingSM,
    color: COLORS.gray700,
  },
  percentTextDone: {
    color: COLORS.primary,
  },
  progressTrack: {
    height: scale(8),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray200,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },

  steps: {
    marginTop: spacing[5],
    gap: spacing[3],
  },
  loadingNote: {
    ...presets.caption,
    color: COLORS.gray500,
    marginTop: spacing[4],
    textAlign: 'center',
  },
  notice: {
    marginTop: spacing[4],
  },

  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    gap: spacing[3],
  },
  footerSolid: {
    paddingTop: spacing[3.5],
    backgroundColor: COLORS.white,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
    ...shadows.lg,
  },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  readyText: {
    ...presets.bodyXS,
    color: COLORS.gray700,
    flex: 1,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
    paddingLeft: spacing[3],
    paddingRight: spacing[2],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  skipPressed: {
    backgroundColor: COLORS.gray100,
  },
  skipText: {
    ...presets.labelSM,
    fontFamily: fonts.semibold,
    color: COLORS.gray600,
  },
});
