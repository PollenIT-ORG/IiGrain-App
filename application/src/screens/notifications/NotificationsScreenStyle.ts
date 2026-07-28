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
    backgroundColor: COLORS.surface,
  },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: COLORS.white,
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray200,
  },
  toolbarText: {
    ...presets.bodySM,
    color: COLORS.gray700,
  },
  markAllBtn: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  /** Groups the toolbar's action buttons on the right-hand side. */
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  dangerText: {
    fontSize: scale(13),
    color: COLORS.danger,
    fontFamily: fonts.semibold,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  /** Selection checkbox, sized to sit where the type icon normally does. */
  checkbox: {
    width: scale(24),
    height: scale(24),
    borderRadius: borderRadius.sm,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: addAlpha(COLORS.primary, 0.08),
  },
  rowDeleteBtn: {
    paddingLeft: spacing[2],
    alignSelf: 'center',
  },
  markAllText: {
    ...presets.labelSM,
    color: COLORS.primary,
    fontFamily: fonts.semibold,
  },

  body: {
    padding: spacing[4],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },

  card: {
    flexDirection: 'row',
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
    ...shadows.xs,
  },
  cardUnread: {
    backgroundColor: addAlpha(COLORS.primary, 0.045),
    borderColor: addAlpha(COLORS.primary, 0.18),
  },
  cardPressed: {
    opacity: 0.85,
  },
  iconCircle: {
    width: scale(44),
    height: scale(44),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: spacing[0.5],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    ...presets.labelMD,
    color: COLORS.gray700,
    flex: 1,
  },
  titleUnread: {
    color: COLORS.gray900,
    fontFamily: fonts.semibold,
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray600,
  },
  time: {
    ...presets.caption,
    color: COLORS.gray500,
    marginTop: spacing[0.5],
  },

  stateCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
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
    minWidth: scale(160),
  },

  footerLoader: {
    paddingVertical: spacing[5],
  },
});
