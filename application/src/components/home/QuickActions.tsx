import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import AppText from '../AppText/AppText';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';

export interface QuickAction {
  key: string;
  icon: string;
  label: string;
  onPress?: () => void;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

const QuickActions: React.FC<QuickActionsProps> = ({ actions }) => (
  <View style={styles.row}>
    {actions.map(a => (
      <TouchableOpacity
        key={a.key}
        style={styles.item}
        activeOpacity={0.8}
        onPress={a.onPress}>
        <View style={styles.iconWrap}>
          <AppIcon name={a.icon} size={moderateScale(24)} color={COLORS.primary} />
        </View>
        <AppText style={styles.label} numberOfLines={2}>
          {a.label}
        </AppText>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  item: { flex: 1, alignItems: 'center', gap: spacing[2] },
  iconWrap: {
    width: scale(56),
    height: scale(56),
    borderRadius: borderRadius.xl,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...presets.labelSM, color: COLORS.gray700, textAlign: 'center',
    fontSize: moderateScale(11),
   },
});

export default QuickActions;