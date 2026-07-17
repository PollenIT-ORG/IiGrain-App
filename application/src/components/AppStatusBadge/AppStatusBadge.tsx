import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { COLORS, borderRadius, fonts, fontWeights, presets, spacing } from '../../constants';
import { addAlpha, scale } from '../../utils';
import AppText from '../AppText/AppText';
import type { BadgeTone } from '../../types/farm';

export type StatusKind =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'completed'
  | 'in_progress';

export type StatusBadgeSize = 'sm' | 'md';

interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

const STATUS_META: Record<StatusKind, StatusMeta> = {
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  in_progress: { label: 'In Progress', tone: 'info' },
};

const TONE_COLOR: Record<BadgeTone, string> = {
  success: COLORS.primary,
  warning: COLORS.warning,
  danger: COLORS.danger,
  info: COLORS.info,
  neutral: COLORS.gray600,
};

export interface AppStatusBadgeProps {
  status?: StatusKind;
  label?: string;
  tone?: BadgeTone;
  size?: StatusBadgeSize;
  showDot?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AppStatusBadge: React.FC<AppStatusBadgeProps> = ({
  status,
  label,
  tone,
  size = 'md',
  showDot = true,
  style,
}) => {
  const meta = status ? STATUS_META[status] : undefined;
  const resolvedTone: BadgeTone = tone ?? meta?.tone ?? 'neutral';
  const resolvedLabel = label ?? meta?.label ?? '';
  const color = TONE_COLOR[resolvedTone];
  const sm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        sm ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: addAlpha(color, 0.1) },
        style,
      ]}>
      {showDot ? (
        <View style={[sm ? styles.dotSm : styles.dotMd, { backgroundColor: color }]} />
      ) : null}
      <AppText
        style={sm ? styles.labelSm : styles.labelMd}
        color={color}
        numberOfLines={1}>
        {resolvedLabel}
      </AppText>
    </View>
  );
};

export default React.memo(AppStatusBadge);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
  },
  badgeMd: {
    gap: spacing[1.5],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    minHeight: scale(24),
  },
  badgeSm: {
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    minHeight: scale(20),
  },
  dotMd: {
    width: scale(6),
    height: scale(6),
    borderRadius: borderRadius.full,
  },
  dotSm: {
    width: scale(5),
    height: scale(5),
    borderRadius: borderRadius.full,
  },
  labelMd: {
    ...presets.labelSM,
    fontFamily: fonts.semibold,
    fontWeight: fontWeights.semibold,
  },
  labelSm: {
    ...presets.caption,
    fontFamily: fonts.semibold,
    fontWeight: fontWeights.semibold,
  },
});
