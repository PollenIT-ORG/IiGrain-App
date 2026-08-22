import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { AppText } from '../../../components';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import { COLORS } from '../../../constants';
import { moderateScale } from '../../../utils';
import type { OnboardingStep } from '../onboardingSteps';
import { styles } from './ChecklistRowStyle';

export interface ChecklistRowProps {
  step: OnboardingStep;
  onPress: () => void;
}

const ChecklistRow: React.FC<ChecklistRowProps> = ({ step, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.75}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${step.title}. ${step.done ? 'Completed' : 'Not done yet'}`}
    style={[styles.row, step.done && styles.rowDone]}>
    <View style={styles.iconTile}>
      <AppIcon name={step.icon} size={moderateScale(22)} color={COLORS.primary} />
    </View>

    <View style={styles.body}>
      <AppText style={styles.title} numberOfLines={1}>
        {step.title}
      </AppText>
      <AppText style={styles.subtitle} numberOfLines={2}>
        {step.subtitle}
      </AppText>
    </View>

    <AppIcon
      name={step.done ? ICONS.CHECK_CIRCLE : ICONS.CIRCLE_OUTLINE}
      size={moderateScale(24)}
      color={step.done ? COLORS.primary : COLORS.gray300}
    />
  </TouchableOpacity>
);

export default React.memo(ChecklistRow);
