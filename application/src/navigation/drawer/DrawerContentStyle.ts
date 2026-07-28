import { StyleSheet } from 'react-native';
import { COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing, fonts } from '../../constants';
import { scale } from '../../utils';

const AVATAR = scale(52);

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scroll: {
    paddingTop: spacing[2],
    paddingHorizontal: spacing[3],
  },

  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    marginBottom: spacing[4],
    borderRadius: borderRadius.xl,
    backgroundColor: COLORS.lightPrimaryBg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  avatarImage: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarText: {
    ...presets.headingSM,
    color: COLORS.white,
  },
  profileTexts: {
    flex: 1,
    gap: spacing[0.5],
  },
  name: {
    ...presets.headingXS,
    color: COLORS.gray900,
  },
  email: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: spacing[1],
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
  },
  roleText: {
    ...presets.caption,
    fontFamily: fonts.semibold,
    color: COLORS.primaryDark,
  },

  sectionLabel: {
    ...presets.overline,
    color: COLORS.gray500,
    marginLeft: spacing[2],
    marginBottom: spacing[2],
  },

  items: {
    gap: spacing[1],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  itemActive: {
    backgroundColor: COLORS.lightPrimary,
  },
  itemIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconActive: {
    backgroundColor: COLORS.white,
  },
  itemLabel: {
    ...presets.labelLG,
    color: COLORS.gray700,
    flex: 1,
  },
  itemLabelActive: {
    color: COLORS.primaryDark,
    fontFamily: fonts.semibold,
  },

  footer: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.white,
  },
  signOutText: {
    ...presets.labelLG,
    color: COLORS.danger,
  },
  version: {
    ...presets.caption,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: spacing[3],
  },
});
