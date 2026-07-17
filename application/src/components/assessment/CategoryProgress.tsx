import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import AppText from '../AppText/AppText';
import type { AssessmentProgress } from '../../types/assessment';
import { QUESTION_STATUS_META } from './QuestionStatusChip';

export interface CategoryProgressProps {
  progress: AssessmentProgress;
}

const CategoryProgress: React.FC<CategoryProgressProps> = ({ progress }) => {
  const buckets: { key: string; label: string; count: number; color: string }[] = [
    {
      key: 'completed',
      label: 'Completed',
      count: progress.completed,
      color: QUESTION_STATUS_META.COMPLETED.color,
    },
    {
      key: 'inProgress',
      label: 'In Progress',
      count: progress.inProgress,
      color: QUESTION_STATUS_META.IN_PROGRESS.color,
    },
    {
      key: 'reviewRequired',
      label: 'Review',
      count: progress.reviewRequired,
      color: QUESTION_STATUS_META.REVIEW_REQUIRED.color,
    },
    {
      key: 'notStarted',
      label: 'Not Started',
      count: progress.notStarted,
      color: QUESTION_STATUS_META.NOT_STARTED.color,
    },
  ];

  return (
    <View style={styles.row}>
      <View style={styles.totalPill}>
        <AppText style={styles.totalText} color={COLORS.gray900}>
          {progress.total} Questions
        </AppText>
      </View>
      {buckets
        .filter(b => b.count > 0)
        .map(b => (
          <View key={b.key} style={styles.statItem}>
            <View style={[styles.dot, { backgroundColor: b.color }]} />
            <AppText style={styles.statText} color={COLORS.gray700}>
              {b.count} {b.label}
            </AppText>
          </View>
        ))}
    </View>
  );
};

export default React.memo(CategoryProgress);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
  },
  totalPill: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray100,
  },
  totalText: {
    ...presets.labelSM,
    letterSpacing: 0,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  dot: {
    width: spacing[2],
    height: spacing[2],
    borderRadius: borderRadius.full,
  },
  statText: {
    ...presets.bodyXS,
  },
});
