import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';

/** FAB geometry and hide/show motion, kept next to the styles that use them. */
export const FAB_METRICS = {
  size: scale(58),
  animMs: 200,
  /** How far the FAB drops when hiding — its own height plus the inset. */
  hideOffset: scale(96),
  hideScale: 0.85,
  ripple: { color: addAlpha(COLORS.white, 0.24), borderless: false },
} as const;

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  body: {
    padding: spacing[4],
    // Clears the FAB so the last field card is never trapped underneath it.
    paddingBottom: spacing[24],
  },

  /** Rhythm between cards. */
  gap: {
    height: spacing[3],
  },
  /** Larger break before a new section starts. */
  sectionGap: {
    height: spacing[6],
  },

  fieldsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    marginBottom: spacing[3.5],
  },
  fieldsHeaderTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  // Pushed to the right edge so the title and count keep their own spacing.
  fieldsHeaderAction: {
    marginLeft: 'auto',
    height: scale(46),
       paddingHorizontal: scale(12),


  },
  fieldsCount: {
    ...presets.labelSM,
    color: COLORS.gray600,
    backgroundColor: COLORS.gray100,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
    overflow: 'hidden',
  },
  fieldsLoader: {
    paddingVertical: spacing[6],
  },
  fieldsEmpty: {
    alignItems: 'center',
    gap: spacing[2.5],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
  fieldsEmptyText: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
  },

  fab: {
    position: 'absolute',
    right: spacing[5],
    bottom: spacing[6],
  },
  fabButton: {
    width: FAB_METRICS.size,
    height: FAB_METRICS.size,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.lg,
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
});
