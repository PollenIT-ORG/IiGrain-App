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

export const styles = StyleSheet.create({
  group: {
    width: '100%',
    marginBottom: spacing[4],
  },

  label: {
    ...presets.inputLabel,
    color: COLORS.gray700,
    marginBottom: spacing[1.5],
  },
  labelError: {
    color: COLORS.danger,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    paddingHorizontal: scale(14),
    height: scale(52),
  },
  fieldPressed: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.gray100,
  },
  fieldError: {
    borderColor: COLORS.danger,
    borderWidth: borderWidth.medium,
  },
  fieldDisabled: {
    backgroundColor: COLORS.gray100,
    opacity: 0.7,
  },

  valueText: {
    ...presets.inputText,
    flex: 1,
    color: COLORS.gray900,
  },
  placeholderText: {
    ...presets.inputText,
    flex: 1,
    color: COLORS.gray500,
  },

  helperError: {
    ...presets.bodyXS,
    color: COLORS.danger,
    marginTop: spacing[1],
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    ...shadows.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray300,
    marginBottom: spacing[2],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingBottom: spacing[2],
    marginBottom: spacing[1],
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray300,
  },
  sheetTitle: {
    ...presets.headingSM,
    flex: 1,
    textAlign: 'center',
    color: COLORS.gray900,
  },
  cancel: {
    ...presets.labelMD,
    color: COLORS.gray500,
  },
  done: {
    ...presets.labelMD,
    color: COLORS.primary,
  },
  iosPicker: {
    alignSelf: 'stretch',
    marginTop: spacing[2],
  },
});
