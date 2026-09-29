import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../../constants';
import { addAlpha, moderateScale, scale } from '../../../utils';

export const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
  },
  submit: {
    marginTop: spacing[2],
  },

  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  lookupText: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  lookupNotice: {
    marginBottom: spacing[3],
  },
  signupNotice: {
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },

  matchCard: {
    marginBottom: spacing[4],
    padding: spacing[3.5],
    gap: spacing[2.5],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.primary, 0.28),
    backgroundColor: COLORS.lightPrimaryBg,
    ...shadows.xs,
  },
  matchHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
  },
  matchIcon: {
    width: scale(26),
    height: scale(26),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  matchHeadTexts: {
    flex: 1,
    gap: scale(2),
  },
  matchTitle: {
    ...presets.labelMD,
    color: COLORS.gray900,
  },
  matchProgram: {
    ...presets.bodyXS,
    color: COLORS.primary,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  matchLabel: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    width: scale(96),
  },
  matchValue: {
    ...presets.labelSM,
    fontSize: moderateScale(13),
    color: COLORS.gray900,
    flex: 1,
  },
  phoneNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1],
    marginTop: -spacing[2],
    marginBottom: spacing[4],
  },
  phoneNote: {
    ...presets.bodyXS,
    flex: 1,
    color: COLORS.gray600,
  },

  lockedGroup: {
    width: '100%',
    marginBottom: spacing[4],
  },
  lockedLabel: {
    ...presets.inputLabel,
    color: COLORS.gray700,
    marginBottom: spacing[1.5],
  },
  lockedField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: COLORS.gray100,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    paddingHorizontal: scale(14),
    minHeight: scale(52),
  },
  lockedValue: {
    ...presets.inputText,
    flex: 1,
    color: COLORS.gray700,
  },
  lockedHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  lockedHint: {
    ...presets.bodyXS,
    flex: 1,
    color: COLORS.gray600,
  },

  matchNote: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    paddingTop: spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: addAlpha(COLORS.primary, 0.2),
  },
});
