import { StyleSheet } from 'react-native';
import {
  borderRadius,
  borderWidth,
  COLORS,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, scale } from '../../utils';

export const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.danger, 0.18),
    backgroundColor: COLORS.white,
    overflow: 'hidden',
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: addAlpha(COLORS.danger, 0.06),
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: addAlpha(COLORS.danger, 0.15),
  },
  headerIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  headerTexts: {
    flex: 1,
    gap: spacing[0.5],
  },
  title: {
    ...presets.labelLG,
    color: COLORS.danger,
  },
  subtitle: {
    ...presets.caption,
    color: COLORS.gray600,
  },
  rows: {
    paddingHorizontal: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  rowIconDanger: {
    backgroundColor: addAlpha(COLORS.danger, 0.1),
  },
  rowTexts: {
    flex: 1,
    gap: spacing[1],
  },
  rowTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  rowTitleDanger: {
    color: COLORS.danger,
  },
  rowDescription: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  divider: {
    height: borderWidth.hairline,
    backgroundColor: COLORS.gray200,
  },
});
