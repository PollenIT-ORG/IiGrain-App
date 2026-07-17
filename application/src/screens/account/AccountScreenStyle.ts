import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { scale } from '../../utils';
import { styles as commonStyles } from '../../styles/index';

const AVATAR = scale(84);

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  body: {
    padding: spacing[4],
    paddingBottom: spacing[12],
  },

  hero: {
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    ...shadows.md,
  },
  avatarText: {
    ...presets.displaySmall,
    color: COLORS.white,
  },
  name: {
    ...presets.headingLG,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  email: {
    ...presets.bodySM,
    color: COLORS.gray600,
    marginTop: spacing[1],
    textAlign: 'center',
  },
  rolePill: {
    marginTop: spacing[3],
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.primaryLighter,
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1],
  },
  roleText: {
    ...presets.labelSM,
    color: COLORS.primaryDark,
  },

  subtitle: {
    ...presets.bodySM,
    color: COLORS.gray600,
    marginTop: spacing[3],
    marginBottom: spacing[7],
    paddingHorizontal: spacing[4],
  },

  footer: {
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[2],
  },
  footerText: {
    ...presets.caption,
    color: COLORS.gray500,
  },

    logo: {
      ...commonStyles.imgStyle.logoMd
    },
});
