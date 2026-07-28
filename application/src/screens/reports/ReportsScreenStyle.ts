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
  skeletonGap: {
    marginTop: spacing[3],
  },
  skeletonBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing[2.5],
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  pickerFarm: {
    flex: 2,
  },
  pickerYear: {
    flex: 1,
  },
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

  inlineEmpty: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[6],
  },
  inlineEmptyText: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
  },

  stateWrap: {
    alignItems: 'center',
    gap: spacing[2],
    paddingTop: spacing[12],
    paddingHorizontal: spacing[4],
  },
  stateTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  stateMsg: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  retry: {
    minWidth: spacing[16] * 3,
    marginTop: spacing[4],
  },
});
