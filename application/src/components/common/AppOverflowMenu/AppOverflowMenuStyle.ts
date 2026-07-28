import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../../constants';
import { addAlpha, moderateScale, scale } from '../../../utils';

/** Layout + motion constants, kept out of the component so nothing is magic. */
export const MENU_METRICS = {
  /** Gap between the trigger's bottom edge and the popup. */
  gap: spacing[1],
  /** Minimum breathing room from the screen edge. */
  screenMargin: spacing[2],
  minWidth: scale(200),
  maxWidth: scale(280),
  iconSize: moderateScale(20),
  openMs: 180,
  closeMs: 140,
  /** Popup grows from slightly small — a subtle "spring out" without overshoot. */
  scaleFrom: 0.92,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
  ripple: { color: addAlpha(COLORS.primary, 0.1) },
  triggerRipple: { color: addAlpha(COLORS.white, 0.2), borderless: true, radius: scale(20) },
} as const;

export const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // Barely-there scrim: enough to catch the dismiss tap and imply depth
    // without dimming the screen like a full dialog would.
    backgroundColor: addAlpha(COLORS.black, 0.08),
  },
  menu: {
    position: 'absolute',
    minWidth: MENU_METRICS.minWidth,
    maxWidth: MENU_METRICS.maxWidth,
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingVertical: spacing[1],
    overflow: 'hidden',
    // Popups sit above cards, so they take the heaviest elevation token.
    ...shadows.xl,
    transformOrigin: 'top right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  rowDivider: {
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray200,
  },
  rowPressed: {
    backgroundColor: COLORS.gray100,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowIcon: {
    width: MENU_METRICS.iconSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTexts: {
    flex: 1,
    gap: spacing[0.5],
  },
  rowTitle: {
    ...presets.labelMD,
  },
  rowDescription: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
});
