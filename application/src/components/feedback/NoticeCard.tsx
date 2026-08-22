import React from 'react';
import { StyleSheet, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { AppIcon } from '../AppIcon';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

export interface NoticeAction {
  label: string;
  onPress: () => void;
  loading?: boolean;
}

export interface NoticeCardProps {
  tone?: NoticeTone;
  icon: string;
  title: string;
  message?: string;
  primaryAction?: NoticeAction;
  secondaryAction?: NoticeAction;
  style?: ViewStyle;
}

const TONE_COLOR: Record<NoticeTone, string> = {
  info: COLORS.primary,
  success: COLORS.success,
  warning: COLORS.validation,
  danger: COLORS.danger,
};

const NoticeCard: React.FC<NoticeCardProps> = ({
  tone = 'info',
  icon,
  title,
  message,
  primaryAction,
  secondaryAction,
  style,
}) => {
  const accent = TONE_COLOR[tone];

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.card,
        { backgroundColor: addAlpha(accent, 0.07), borderColor: addAlpha(accent, 0.28) },
        style,
      ]}>
      <View style={styles.head}>
        <View style={[styles.iconCircle, { backgroundColor: addAlpha(accent, 0.14) }]}>
          <AppIcon name={icon} size={moderateScale(18)} color={accent} />
        </View>
        <View style={styles.flex}>
          <AppText style={[styles.title, { color: accent }]}>{title}</AppText>
          {message ? <AppText style={styles.message}>{message}</AppText> : null}
        </View>
      </View>

      {primaryAction ? (
        <Button
          title={primaryAction.label}
          onPress={primaryAction.onPress}
          loading={primaryAction.loading}
          size="sm"
          style={styles.primary}
        />
      ) : null}

      {secondaryAction ? (
        <TouchableOpacity
          onPress={secondaryAction.onPress}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.secondary}>
          <AppText style={styles.secondaryText}>{secondaryAction.label}</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default React.memo(NoticeCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    padding: spacing[4],
    gap: spacing[3],
  },
  flex: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  iconCircle: {
    width: scale(36),
    height: scale(36),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...presets.labelLG,
  },
  message: {
    ...presets.bodyXS,
    color: COLORS.gray700,
    marginTop: spacing[1],
  },
  primary: {
    marginTop: spacing[0.5],
  },
  secondary: {
    alignSelf: 'center',
  },
  secondaryText: {
    ...presets.linkText,
    color: COLORS.gray700,
  },
});
