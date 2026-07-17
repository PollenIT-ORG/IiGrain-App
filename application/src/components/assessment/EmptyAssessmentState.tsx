import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';

export interface EmptyAssessmentStateProps {
  icon?: string;
  title?: string;
  message?: string;
}

const EmptyAssessmentState: React.FC<EmptyAssessmentStateProps> = ({
  icon = 'clipboard-check-outline',
  title = 'No History Yet',
  message = 'Completed assessments will appear here once you finish your first evaluation.',
}) => (
  <View style={styles.wrap} accessibilityLabel={title}>
    <View style={styles.iconCircle}>
      <AppIcon name={icon} size={moderateScale(48)} color={COLORS.primary} />
    </View>
    <AppText style={styles.title}>{title}</AppText>
    <AppText style={styles.message}>{message}</AppText>
  </View>
);

export default React.memo(EmptyAssessmentState);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[16],
  },
  iconCircle: {
    width: scale(104),
    height: scale(104),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimaryBg,
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
  },
});
