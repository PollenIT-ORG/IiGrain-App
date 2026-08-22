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
    backgroundColor: COLORS.white,
  },
  body: {
    flexGrow: 1,
    padding: spacing[5],
    paddingTop: spacing[6],
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
  progress: {
    marginTop: spacing[5],
  },
  progressTrack: {
    height: scale(6),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray200,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
  },
  progressText: {
    ...presets.caption,
    color: COLORS.gray600,
    marginTop: spacing[2],
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
    backgroundColor: COLORS.white,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
    ...shadows.sm,
  },
  skipRow: {
    alignItems: 'flex-end',
    marginTop: spacing[2],
  },
  skipText: {
    ...presets.labelMD,
    fontFamily: fonts.semibold,
    color: COLORS.gray600,
    paddingVertical: spacing[1],
  },
});
