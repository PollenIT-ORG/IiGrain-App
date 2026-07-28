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
import { addAlpha, scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  body: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },

  intro: {
    ...presets.bodySM,
    color: COLORS.gray600,
    marginBottom: spacing[5],
  },

  sectionTitle: {
    ...presets.labelSM,
    fontFamily: fonts.semibold,
    color: COLORS.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing[2],
  },

  card: {
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing[5],
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  rowBorder: {
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray300,
  },
  rowIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.md,
    backgroundColor: addAlpha(COLORS.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTexts: { flex: 1, gap: spacing[0.5] },
  rowLabel: { ...presets.labelLG, color: COLORS.gray900 },
  rowHint: { ...presets.bodySM, color: COLORS.gray600 },
});
