import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { addAlpha } from '../../utils';
import AppText from '../AppText/AppText';
import type { QuestionStatus } from '../../types/assessment';

export interface QuestionStatusMeta {
  label: string;
  color: string;
  bg: string;
  icon: string;
}

export const QUESTION_STATUS_META: Record<QuestionStatus, QuestionStatusMeta> = {
  NOT_STARTED: {
    label: 'Not Started',
    color: COLORS.gray700,
    bg: addAlpha(COLORS.gray500, 0.16),
    icon: 'circle-outline',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: COLORS.accent,
    bg: addAlpha(COLORS.warning, 0.2),
    icon: 'circle-slice-4',
  },
  REVIEW_REQUIRED: {
    label: 'Review',
    color: COLORS.info,
    bg: addAlpha(COLORS.info, 0.14),
    icon: 'circle-slice-6',
  },
  COMPLETED: {
    label: 'Completed',
    color: COLORS.success,
    bg: addAlpha(COLORS.success, 0.14),
    icon: 'check-circle',
  },
};

export interface QuestionStatusChipProps {
  status: QuestionStatus;
}

const QuestionStatusChip: React.FC<QuestionStatusChipProps> = ({ status }) => {
  const meta = QUESTION_STATUS_META[status];
  return (
    <View
      style={[styles.chip, { backgroundColor: meta.bg }]}
      accessibilityLabel={`Status: ${meta.label}`}>
      <AppText style={[styles.label, { color: meta.color }]}>{meta.label}</AppText>
    </View>
  );
};

export default React.memo(QuestionStatusChip);

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  label: {
    ...presets.labelSM,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
