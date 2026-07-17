import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { AppIcon } from '../AppIcon';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import type { BadgeTone } from '../../types/farm';

export interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  tone?: BadgeTone;
}

const ICON_BG: Record<BadgeTone, ViewStyle> = {
  success: { backgroundColor: addAlpha(COLORS.success, 0.12) },
  warning: { backgroundColor: addAlpha(COLORS.warning, 0.16) },
  danger: { backgroundColor: addAlpha(COLORS.danger, 0.1) },
  info: { backgroundColor: addAlpha(COLORS.info, 0.1) },
  neutral: { backgroundColor: COLORS.lightPrimary },
};

const ICON_COLOR: Record<BadgeTone, string> = {
  success: COLORS.success,
  warning: COLORS.accent,
  danger: COLORS.danger,
  info: COLORS.info,
  neutral: COLORS.primary,
};

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, tone = 'neutral' }) => (
  <View style={styles.card}>
    <View style={[styles.iconCircle, ICON_BG[tone]]}>
      <AppIcon name={icon} size={moderateScale(18)} color={ICON_COLOR[tone]} />
    </View>
    <AppText style={styles.value} numberOfLines={1}>
      {value}
    </AppText>
    <AppText style={styles.label} numberOfLines={1}>
      {label}
    </AppText>
  </View>
);

export default React.memo(StatCard);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    borderRadius: borderRadius.xl,
    padding: spacing[3],
    gap: spacing[1],
    ...shadows.xs,
  },
  iconCircle: {
    width: scale(36),
    height: scale(36),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  value: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  label: {
    ...presets.bodyXS,
    color: COLORS.gray700,
  },
});
