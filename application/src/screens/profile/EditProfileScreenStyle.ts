import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  spacing,
} from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing[4],
    paddingBottom: spacing[10],
  },

  intro: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginBottom: spacing[6],
  },

  readonlyGroup: {
    width: '100%',
    marginBottom: spacing[4],
  },
  readonlyLabel: {
    ...presets.inputLabel,
    color: COLORS.gray700,
    marginBottom: spacing[1.5],
  },
  readonlyField: {
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
  readonlyValue: {
    ...presets.inputText,
    flex: 1,
    color: COLORS.gray700,
  },

  submit: {
    marginTop: spacing[4],
  },
});
