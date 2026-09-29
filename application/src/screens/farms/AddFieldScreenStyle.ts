import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  spacing,
} from '../../constants';
import { addAlpha, scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing[4],
    paddingBottom: spacing[10],
  },

  heroIcon: {
    alignSelf: 'center',
    width: scale(56),
    height: scale(56),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  caption: {
    ...presets.bodySM,
    color: COLORS.gray700,
    textAlign: 'center',
    marginBottom: spacing[6],
  },

  fieldLabel: {
    ...presets.inputLabel,
    color: COLORS.gray700,
    marginBottom: spacing[1.5],
  },

  areaWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    marginTop: -spacing[2],
    marginBottom: spacing[4],
    padding: spacing[2.5],
    borderRadius: borderRadius.md,
    backgroundColor: addAlpha(COLORS.warning, 0.14),
  },
  areaWarningText: {
    ...presets.caption,
    color: COLORS.warning,
    flex: 1,
  },

  farmGrowth: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2.5],
    marginTop: -spacing[2],
    marginBottom: spacing[4],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.validation, 0.3),
    backgroundColor: addAlpha(COLORS.validation, 0.08),
  },
  farmGrowthIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmGrowthTexts: {
    flex: 1,
    gap: spacing[0.5],
  },
  farmGrowthTitle: {
    ...presets.labelSM,
    color: COLORS.gray900,
  },
  farmGrowthText: {
    ...presets.caption,
    color: COLORS.gray700,
  },
  farmGrowthStrong: {
    fontFamily: fonts.semibold,
    color: COLORS.validation,
  },

  statusRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    height: scale(46),
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    paddingHorizontal: scale(6),
  },
  statusDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...presets.labelSM,
    color: COLORS.gray700,
  },
  statusTextActive: {
    color: COLORS.white,
  },

  dateRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[5],
  },
  dateCol: {
    flex: 1,
  },

  soilDivider: {
    height: borderWidth.thin,
    backgroundColor: COLORS.gray300,
    marginTop: spacing[5],
    marginBottom: spacing[4],
  },
  soilTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.white,
  },
  soilTriggerSpaced: {
    marginTop: spacing[4],
  },
  soilTriggerPressed: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.primary,
  },
  soilTriggerErrorBorder: {
    borderColor: COLORS.danger,
  },
  soilTriggerLocked: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
  },
  soilTriggerIconLocked: {
    backgroundColor: COLORS.gray200,
  },
  soilTriggerTitleLocked: {
    color: COLORS.gray500,
  },
  required: {
    color: COLORS.danger,
  },
  triggerError: {
    ...presets.bodyXS,
    color: COLORS.danger,
    marginTop: spacing[1],
  },
  soilTriggerIcon: {
    width: scale(42),
    height: scale(42),
    borderRadius: borderRadius.md,
    backgroundColor: addAlpha(COLORS.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  soilTriggerTexts: {
    flex: 1,
    gap: spacing[0.5],
  },
  soilTriggerTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  soilTriggerSub: {
    ...presets.caption,
    color: COLORS.gray500,
  },
  soilBadge: {
    minWidth: scale(22),
    height: scale(22),
    paddingHorizontal: spacing[1.5],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soilBadgeText: {
    ...presets.labelSM,
    color: COLORS.white,
  },

  submit: {
    marginTop: spacing[4],
  },
});
