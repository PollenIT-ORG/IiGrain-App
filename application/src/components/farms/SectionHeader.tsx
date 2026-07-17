import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, presets, spacing } from '../../constants';
import AppText from '../AppText/AppText';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionLabel,
  onActionPress,
}) => (
  <View style={styles.row}>
    <AppText style={styles.title}>{title}</AppText>
    {actionLabel && onActionPress ? (
      <TouchableOpacity
        onPress={onActionPress}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}>
        <AppText style={styles.action}>{actionLabel}</AppText>
      </TouchableOpacity>
    ) : null}
  </View>
);

export default React.memo(SectionHeader);

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  action: {
    ...presets.linkText,
    color: COLORS.primary,
  },
});
