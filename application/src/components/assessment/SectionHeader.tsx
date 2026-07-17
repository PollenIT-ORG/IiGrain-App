import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, presets, spacing } from '../../constants';
import AppText from '../AppText/AppText';

export interface SectionHeaderProps {
  title: string;
  rightLabel?: string;
  onRightPress?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  rightLabel,
  onRightPress,
}) => (
  <View style={styles.row}>
    <AppText style={styles.title}>{title}</AppText>
    {rightLabel ? (
      <TouchableOpacity
        onPress={onRightPress}
        accessibilityRole="button"
        accessibilityLabel={rightLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <AppText style={styles.right} color={COLORS.primary}>
          {rightLabel}
        </AppText>
      </TouchableOpacity>
    ) : null}
  </View>
);

export default React.memo(SectionHeader);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  title: {
    ...presets.headingXS,
    color: COLORS.gray900,
  },
  right: {
    ...presets.labelSM,
  },
});
