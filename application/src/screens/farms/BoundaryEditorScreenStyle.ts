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
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    backgroundColor: COLORS.surface,
  },
  mapLoadingText: {
    ...presets.bodySM,
    color: COLORS.gray600,
  },

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

  rail: {
    right: spacing[3],
  },

  gpsPointBtn: {
    position: 'absolute',
    left: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.66)',
    ...shadows.lg,
  },
  gpsPointText: {
    ...presets.labelSM,
    fontFamily: fonts.semibold,
    color: COLORS.white,
  },

  nudgePad: {
    right: spacing[3],
  },

  howToDrawBtn: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.66)',
    ...shadows.md,
  },
  howToDrawText: {
    ...presets.labelSM,
    fontFamily: fonts.semibold,
    color: COLORS.white,
  },

  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
