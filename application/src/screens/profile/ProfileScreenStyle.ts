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

const AVATAR_SIZE = scale(96);

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  body: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },

  identity: {
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
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
    color: COLORS.gray700,
    marginTop: spacing[1],
    textAlign: 'center',
  },
  roleBadge: {
    ...presets.labelSM,
    marginTop: spacing[3],
    color: COLORS.primary,
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },

  sectionTitle: {
    ...presets.overline,
    color: COLORS.gray700,
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    overflow: 'hidden',
    marginBottom: spacing[6],
    ...shadows.sm,
  },

  infoRow: {
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
  infoIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    ...presets.bodyXS,
    color: COLORS.gray700,
    marginBottom: spacing[0.5],
  },
  infoValue: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  actionLabel: {
    ...presets.labelLG,
    flex: 1,
    color: COLORS.gray900,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
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

  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[16],
  },
  stateTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
    marginTop: spacing[4],
    textAlign: 'center',
  },
  stateMessage: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginTop: spacing[2],
    marginBottom: spacing[6],
    textAlign: 'center',
  },
  retryBtn: {
    minWidth: scale(180),
  },

  skeleton: {
    backgroundColor: COLORS.gray300,
    borderRadius: borderRadius.md,
  },
  skeletonAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.gray300,
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  skeletonCentered: {
    alignSelf: 'center',
  },
  skeletonCenteredSpaced: {
    alignSelf: 'center',
    marginTop: spacing[2.5],
  },
  skeletonStacked: {
    marginTop: spacing[2],
  },

  orgLoadingCard: {
    alignItems: 'center',
    paddingVertical: spacing[5],
  },
  orgEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  orgEmptyText: {
    ...presets.bodySM,
    color: COLORS.gray700,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
  },
  modalTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
    marginBottom: spacing[2],
  },
  modalMessage: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginBottom: spacing[6],
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  modalBtn: {
    flex: 1,
  },
  modalBtnDanger: {
    flex: 1,
    backgroundColor: COLORS.danger,
  },
});
