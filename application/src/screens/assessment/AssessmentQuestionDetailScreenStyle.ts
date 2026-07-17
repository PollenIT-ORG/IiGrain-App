import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: {
    flex: 1,
  },
  body: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[5],
  },
  section: {
    gap: spacing[3],
  },

  commentBox: {
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.white,
    paddingHorizontal: spacing[3.5],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  commentInput: {
    ...presets.bodySM,
    color: COLORS.gray900,
    minHeight: scale(88),
    padding: 0,
  },
  charCount: {
    ...presets.caption,
    alignSelf: 'flex-end',
    marginTop: spacing[1],
  },

  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.lg,
    padding: spacing[3.5],
  },
  lockedBannerText: {
    ...presets.bodyXS,
    color: COLORS.primaryDark,
    flex: 1,
  },
  readonlyBox: {
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.gray100,
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[3],
  },
  readonlyText: {
    ...presets.bodySM,
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
    marginBottom: spacing[6],
    textAlign: 'center',
  },
  retryBtn: {
    minWidth: moderateScale(160),
  },
});
