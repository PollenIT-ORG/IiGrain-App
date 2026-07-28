import { StyleSheet } from 'react-native';
import { COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing, fonts } from '../../constants';
import { addAlpha, scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  body: {
    padding: spacing[4],
  },

  flex: { flex: 1 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  avatar: {
    width: scale(56),
    height: scale(56),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: scale(56),
    height: scale(56),
    borderRadius: borderRadius.full,
  },
  avatarText: { ...presets.headingMD, color: COLORS.primary },
  name: { ...presets.headingSM, color: COLORS.gray900 },
  email: { ...presets.bodySM, color: COLORS.gray600 },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing[1],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
  },
  roleText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.primaryDark },
  badge: {
    ...presets.labelSM,
    alignSelf: 'flex-start',
    color: COLORS.secondary,
    backgroundColor: COLORS.white,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    marginBottom: spacing[5],
  },
  menu: {
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
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
    width: scale(36),
    height: scale(36),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...presets.labelLG,
    flex: 1,
    color: COLORS.gray900,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[6],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.white,
  },
  logoutText: {
    ...presets.labelLG,
    color: COLORS.danger,
  },
});
