import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';

interface NextAssessmentCardProps {
  title: string;
  dueLabel: string;
  onContinue?: () => void;
  actionLabel?: string;
}

const NextAssessmentCard: React.FC<NextAssessmentCardProps> = ({
  title,
  dueLabel,
  onContinue,
  actionLabel = 'Continue',
}) => (
  <View style={styles.card}>
    <View style={styles.iconCircle}>
      <AppIcon name={ICONS.CALENDAR_CLOCK} size={moderateScale(22)} color={COLORS.primary} />
    </View>
    <View style={styles.texts}>
      <AppText style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      <AppText style={styles.sub} numberOfLines={1}>
        {dueLabel}
      </AppText>
    </View>
    <Button
      title={actionLabel}
      size="sm"
      fullWidth={false}
      onPress={onContinue ?? (() => {})}
      style={styles.btn}
    />
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
    ...shadows.sm,
  },
  iconCircle: {
    width: scale(44),
    height: scale(44),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: spacing[0.5] },
  title: { ...presets.labelLG, color: COLORS.gray900 },
  sub: { ...presets.bodyXS, color: COLORS.gray500 },
  btn: { paddingHorizontal: spacing[4], minHeight: scale(38) },
});

export default NextAssessmentCard;
