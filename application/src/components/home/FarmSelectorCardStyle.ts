import { StyleSheet } from 'react-native';
import {
  borderRadius,
  borderWidth,
  COLORS,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    marginTop: spacing[3],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.75,
  },
  iconTile: {
    width: scale(44),
    height: scale(44),
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightPrimary,
  },
  texts: {
    flex: 1,
    gap: spacing[0.5],
  },
  overline: {
    ...presets.overline,
    color: COLORS.gray500,
  },
  name: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  meta: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  chevron: {
    width: scale(32),
    height: scale(32),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightPrimary,
  },
});
