import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, presets, shadows, spacing } from '../../constants';
import { scale } from '../../utils';

export const TRACK_PADDING = spacing[1];

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: COLORS.gray100,
    borderRadius: borderRadius.full,
    padding: TRACK_PADDING,
    marginBottom: spacing[6],
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    backgroundColor: COLORS.white ,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    height: scale(44),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  tabText: {
    ...presets.buttonSM,
  },
});
