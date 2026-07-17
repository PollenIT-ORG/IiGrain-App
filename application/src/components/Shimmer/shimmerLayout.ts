import { StyleSheet } from 'react-native';

export const shimmerLayout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  rowStart: { flexDirection: 'row' },
  flex1: { flex: 1 },
});
