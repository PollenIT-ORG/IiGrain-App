import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../constants';
import { scale } from '../../utils';

const DOT_SIZE = scale(26);

export const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[6],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  step: {
    alignItems: 'center',
    width: scale(78),
  },

  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
  },
  dotActive: {
    backgroundColor: COLORS.lightPrimary,
    borderColor: COLORS.primary,
  },
  dotDone: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  dotText: {
    ...presets.labelSM,
    color: COLORS.gray600,
  },
  dotTextActive: {
    color: COLORS.primary,
  },

  label: {
    ...presets.caption,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: spacing[1.5],
  },
  labelOn: {
    color: COLORS.gray900,
  },

  connector: {
    flex: 1,
    height: scale(2),
    marginTop: DOT_SIZE / 2 - scale(1),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray200,
    overflow: 'hidden',
  },
  connectorFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
  },
});
