import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon, ICONS } from '../AppIcon';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import type { AssessmentQuestion } from '../../types/assessment';
import QuestionStatusChip, { QUESTION_STATUS_META } from './QuestionStatusChip';

export interface QuestionCardProps {
  question: AssessmentQuestion;
  onPress: (question: AssessmentQuestion) => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, onPress }) => {
  const scaleValue = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const handlePressIn = useCallback(() => {
    scaleValue.value = withTiming(0.97, { duration: 120 });
  }, [scaleValue]);

  const handlePressOut = useCallback(() => {
    scaleValue.value = withTiming(1, { duration: 140 });
  }, [scaleValue]);

  const handlePress = useCallback(() => onPress(question), [onPress, question]);

  const statusMeta = QUESTION_STATUS_META[question.status];

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`Question ${question.index}: ${question.title}, ${statusMeta.label}`}
        style={styles.card}>
        <View style={styles.numberBadge}>
          <AppText style={styles.numberText} color={COLORS.primary}>
            Q{question.index}
          </AppText>
        </View>

        <View style={styles.center}>
          <AppText style={styles.title} numberOfLines={1}>
            {question.title}
          </AppText>
          <AppText style={styles.description} numberOfLines={2}>
            {question.description}
          </AppText>
          <View style={styles.chipRow}>
            <QuestionStatusChip status={question.status} />
          </View>
        </View>

        <View style={styles.right}>
          <AppIcon
            name={statusMeta.icon}
            size={moderateScale(20)}
            color={statusMeta.color}
          />
          <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(22)} color={COLORS.gray500} />
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default React.memo(QuestionCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    padding: spacing[3.5],
    ...shadows.sm,
  },
  numberBadge: {
    width: scale(40),
    height: scale(40),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  numberText: {
    ...presets.labelMD,
  },
  center: {
    flex: 1,
    gap: spacing[1],
  },
  title: {
    ...presets.labelLG,
    color: COLORS.gray900,
    letterSpacing: 0,
  },
  description: {
    ...presets.bodyXS,
    color: COLORS.gray700,
  },
  chipRow: {
    marginTop: spacing[1],
  },
  right: {
    alignItems: 'center',
    gap: spacing[1.5],
    flexShrink: 0,
  },
});
