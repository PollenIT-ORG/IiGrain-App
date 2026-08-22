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

export const CONFIRM_METRICS = {
  enterMs: 220,
  exitMs: 160,
  scaleFrom: 0.94,
  liftFrom: 12,
  iconSize: moderateScale(26),
} as const;

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: addAlpha(COLORS.black, 0.45),
  },
  backdropPress: {
    flex: 1,
  },
  card: {
    width: '100%',
    maxWidth: scale(400),
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    gap: spacing[3],
    ...shadows.xl,
  },
  iconCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleDanger: {
    backgroundColor: addAlpha(COLORS.danger, 0.12),
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray700,
  },
  list: {
    gap: spacing[2],
    backgroundColor: COLORS.gray100,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
  },
  listDanger: {
    backgroundColor: addAlpha(COLORS.danger, 0.06),
    borderColor: addAlpha(COLORS.danger, 0.2),
  },
  listHeading: {
    ...presets.labelSM,
    color: COLORS.gray600,
    textTransform: 'uppercase',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2.5],
  },
  bullet: {
    width: scale(6),
    height: scale(6),
    borderRadius: borderRadius.full,
    marginTop: spacing[1.5],
  },
  bulletKeep: {
    backgroundColor: COLORS.success,
  },
  listText: {
    ...presets.bodySM,
    color: COLORS.gray700,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[1],
  },
  action: {
    flex: 1,
  },
});
