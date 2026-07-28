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

  // ── Top bar: back + title + map-type switch ─────────────────────────────
  topBar: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
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

  // ── Map-type switch (top offset applied inline from safe-area insets) ────
  kindSwitch: {
    position: 'absolute',
    right: spacing[3],
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
    ...shadows.md,
  },
  kindOption: { paddingHorizontal: spacing[2.5], paddingVertical: spacing[2] },
  kindOptionActive: { backgroundColor: COLORS.primary },
  kindLabel: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.gray700 },
  kindLabelActive: { color: COLORS.white },

  // ── Crosshair-place add button ──────────────────────────────────────────
  addPointBtn: {
    position: 'absolute',
    alignSelf: 'center',
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

  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
