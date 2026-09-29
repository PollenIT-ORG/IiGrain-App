import { StyleSheet } from 'react-native';
import { COLORS, presets, spacing } from '../../constants';

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
    marginBottom: spacing[5],
  },

  notice: {
    marginBottom: spacing[4],
  },

  counter: {
    ...presets.bodyXS,
    color: COLORS.gray500,
    alignSelf: 'flex-end',
    marginTop: -spacing[2],
    marginBottom: spacing[2],
  },

  submit: {
    marginTop: spacing[4],
  },
});
