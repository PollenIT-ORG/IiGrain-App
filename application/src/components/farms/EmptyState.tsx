import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';

export interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}) => (
  <View style={styles.wrap}>
    <View style={styles.illustration}>
      <AppIcon name={icon} size={moderateScale(48)} color={COLORS.primary} />
    </View>
    <AppText style={styles.title}>{title}</AppText>
    <AppText style={styles.message}>{message}</AppText>
    {actionLabel && onAction ? (
      <Button
        title={actionLabel}
        onPress={onAction}
        fullWidth={false}
        style={styles.action}
      />
    ) : null}
  </View>
);

export default React.memo(EmptyState);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[16],
  },
  illustration: {
    width: scale(104),
    height: scale(104),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray700,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  action: {
    minWidth: scale(200),
  },
});
