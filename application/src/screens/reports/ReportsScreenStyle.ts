import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  body: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },

  filters: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  filterCol: {
    flex: 1,
  },

  section: {
    marginTop: spacing[2],
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    ...shadows.sm,
  },
  cardTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
    marginBottom: spacing[4],
  },
  bars: {
    gap: spacing[1],
  },
});
