import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { scale } from '../../utils';
import AppText from '../AppText/AppText';

export interface WarningListProps {
  items: string[];
  style?: StyleProp<ViewStyle>;
}

const WarningList: React.FC<WarningListProps> = ({ items, style }) => (
  <View style={[styles.list, style]}>
    {items.map(item => (
      <View key={item} style={styles.row}>
        <View style={styles.dot} />
        <AppText style={styles.text}>{item}</AppText>
      </View>
    ))}
  </View>
);

export default React.memo(WarningList);

const styles = StyleSheet.create({
  list: {
    gap: spacing[2.5],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  dot: {
    width: scale(7),
    height: scale(7),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.danger,
    marginTop: scale(6),
  },
  text: {
    ...presets.bodySM,
    color: COLORS.gray700,
    flex: 1,
  },
});
