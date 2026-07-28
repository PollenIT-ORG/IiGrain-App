import { StyleSheet } from 'react-native';
import { COLORS, borderWidth, fonts, presets, shadows, spacing } from '../../constants';
import { scale } from '../../utils';
import { styles as commonStyles } from '../../styles/index';

export const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 0,
    ...shadows.sm,
  },
  wrapperWhite: {
    backgroundColor: COLORS.white,
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray300,
    ...shadows.sm,
  },
  bar: {
    height: scale(56),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
  },
  side: {
    minWidth: scale(64),
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  badge: {
    position: 'absolute',
    top: -scale(5),
    right: -scale(7),
    minWidth: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(3),
    borderWidth: scale(1.5),
    borderColor: COLORS.white,
  },
  badgeText: {
    ...presets.caption,
    fontSize: scale(9),
    lineHeight: scale(11),
    color: COLORS.white,
    fontFamily: fonts.semibold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...presets.headingSM,
    color: COLORS.white,
  },
  titleDark: {
    color: COLORS.gray900,
  },
  logo: {
    ...commonStyles.imgStyle.logoSm,
  },
});
