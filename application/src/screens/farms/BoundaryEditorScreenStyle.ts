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
  safe: { flex: 1, backgroundColor: COLORS.black },
  mapWrap: { flex: 1 },
  map: { flex: 1 },

  topBar: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  searchWrap: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
  },
  backBtn: {
    width: scale(44),
    height: scale(44),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.md,
  },
  titlePill: {
    flex: 1,
    height: scale(44),
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    ...shadows.md,
  },
  title: { ...presets.labelMD, fontFamily: fonts.semibold, color: COLORS.gray900 },
  subtitle: { ...presets.caption, color: COLORS.gray500 },

  pointsPanel: {
    left: spacing[3],
  },

  kindSwitch: {
    position: 'absolute',
    right: spacing[3],
  },

  actionStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing[2],
  },
  addPointBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
    ...shadows.lg,
  },
  addPointText: { ...presets.labelMD, fontFamily: fonts.semibold, color: COLORS.white },

  gpsBtn: { backgroundColor: 'rgba(0,0,0,0.62)' },
  undoBtn: { backgroundColor: 'rgba(0,0,0,0.62)' },
  deletePointBtn: { backgroundColor: COLORS.danger },
  closeShapeBtn: { backgroundColor: COLORS.primaryDark },

  liveStats: {
    position: 'absolute',
    right: spacing[3],
    alignItems: 'flex-end',
    gap: 2,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  liveStatText: { ...presets.labelSM, fontFamily: fonts.semibold, color: COLORS.white },
  liveStatMuted: { ...presets.caption, color: 'rgba(255,255,255,0.75)' },

  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairRing: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    borderWidth: 2.5,
    borderColor: COLORS.white,
    backgroundColor: 'rgba(19,111,63,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  crosshairDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: COLORS.white,
  },

  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
