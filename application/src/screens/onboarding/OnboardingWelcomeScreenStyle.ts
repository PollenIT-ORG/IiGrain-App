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

const BADGE = scale(88);

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  body: {
    flexGrow: 1,
    padding: spacing[5],
    paddingTop: spacing[6],
    gap: spacing[5],
  },
  hero: {
    alignItems: 'center',
  },
  celebration: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
  },
  title: {
    ...presets.headingXL,
    color: COLORS.gray900,
  },
  subtitle: {
    ...presets.bodyMD,
    color: COLORS.gray600,
    marginTop: spacing[2],
    paddingHorizontal: spacing[4],
  },
  tip: {
    flexDirection: 'row',
    gap: spacing[3],
    backgroundColor: COLORS.gray100,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
  },
  tipIcon: {
    marginTop: spacing[0.5],
  },
  tipBody: {
    flex: 1,
  },
  tipTitle: {
    ...presets.bodyMD,
    fontFamily: fonts.semibold,
    color: COLORS.gray900,
  },
  tipText: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginTop: spacing[1],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: COLORS.white,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
    ...shadows.sm,
  },
});
