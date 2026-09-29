import React from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import { COLORS } from '../../../constants';
import { moderateScale } from '../../../utils';
import type { OnboardingStep } from '../onboardingSteps';
import { styles } from './ChecklistRowStyle';

export interface ChecklistRowProps {
  step: OnboardingStep;
  index: number;
  isNext?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

const ChecklistRow: React.FC<ChecklistRowProps> = ({
  step,
  index,
  isNext = false,
  disabled = false,
  onPress,
}) => {
  const blocked = step.done || disabled;
  return (
    <Pressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: disabled && !step.done }}
      accessibilityLabel={`Step ${index + 1}. ${step.title}. ${
        step.done ? 'Completed' : 'Not done yet'
      }`}
      accessibilityHint={step.done ? undefined : 'Opens this step'}
      style={({ pressed }) => [
        styles.row,
        step.done && styles.rowDone,
        isNext && styles.rowNext,
        pressed && !blocked && styles.rowPressed,
      ]}
    >
      <View style={[styles.iconTile, step.done && styles.iconTileDone]}>
        <AppIcon
          name={step.icon}
          size={moderateScale(22)}
          color={step.done ? COLORS.white : COLORS.primary}
        />
        <View style={[styles.stepBadge, step.done && styles.stepBadgeDone]}>
          <AppText
            style={[
              styles.stepBadgeText,
              step.done && styles.stepBadgeTextDone,
            ]}
          >
            {index + 1}
          </AppText>
        </View>
      </View>

      <View style={styles.body}>
        {isNext ? (
          <View style={styles.nextChip}>
            <AppText style={styles.nextChipText}>NEXT STEP</AppText>
          </View>
        ) : null}
        <AppText style={styles.title} numberOfLines={1}>
          {step.title}
        </AppText>
        <AppText style={styles.subtitle} numberOfLines={2}>
          {step.subtitle}
        </AppText>
      </View>

      <View style={styles.tail}>
        {step.done ? (
          <View style={styles.donePill}>
            <AppIcon
              name={ICONS.CHECK_CIRCLE}
              size={moderateScale(14)}
              color={COLORS.primary}
            />
            <AppText style={styles.donePillText}>Done</AppText>
          </View>
        ) : (
          <>
            <AppIcon
              name={ICONS.CIRCLE_OUTLINE}
              size={moderateScale(22)}
              color={COLORS.gray300}
            />
            <View style={[styles.chevron, isNext && styles.chevronNext]}>
              <AppIcon
                name={ICONS.CHEVRON_RIGHT}
                size={moderateScale(18)}
                color={isNext ? COLORS.white : COLORS.gray600}
              />
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
};

export default React.memo(ChecklistRow);
