import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  shadows,
  spacing,
} from '../../../constants';
import { scale } from '../../../utils';

const TILE = scale(40);

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    ...shadows.xs,
  },
  rowDone: {
    borderColor: COLORS.primaryLighter,
    backgroundColor: COLORS.lightPrimaryBg,
  },
  iconTile: {
    width: TILE,
    height: TILE,
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    ...presets.bodyMD,
    fontFamily: fonts.semibold,
    color: COLORS.gray900,
  },
  subtitle: {
    ...presets.bodySM,
    color: COLORS.gray600,
    marginTop: spacing[0.5],
  },
});
