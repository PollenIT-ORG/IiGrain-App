import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  spacing,
} from '../../../constants';
import { scale } from '../../../utils';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.lightPrimaryBg,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.primaryLighter,
    padding: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  name: {
    ...presets.headingSM,
    color: COLORS.primary,
    flexShrink: 1,
  },
  tier: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  tierText: {
    ...presets.overline,
    fontFamily: fonts.semibold,
    color: COLORS.gray700,
    letterSpacing: scale(0.6),
  },
  row: {
    marginBottom: spacing[3],
  },
  label: {
    ...presets.caption,
    color: COLORS.gray600,
    marginBottom: spacing[0.5],
  },
  value: {
    ...presets.bodyMD,
    fontFamily: fonts.semibold,
    color: COLORS.gray900,
  },
  emptyNote: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginTop: spacing[2],
  },
  shimmerBody: {
    marginTop: spacing[4],
    gap: spacing[3],
  },
});
