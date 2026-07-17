import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  container: {
    marginTop: -spacing[2],
    marginBottom: spacing[4],
  },

  track: {
    height: scale(6),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },

  label: {
    ...presets.labelSM,
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },

  checklist: {
    gap: spacing[1.5],
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  checkText: {
    ...presets.bodyXS,
    color: COLORS.gray700,
  },
  checkTextMet: {
    color: COLORS.gray900,
  },
});
