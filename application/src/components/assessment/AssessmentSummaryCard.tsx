import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, formatDate, moderateScale } from '../../utils';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';
import type { AssessmentSummary } from '../../types/assessment';
import AssessmentProgressMeter from './AssessmentProgressMeter';
import AssessmentStatusBadge from './AssessmentStatusBadge';

export interface AssessmentSummaryCardProps {
  summary: AssessmentSummary;
  title?: string;
  onContinue?: () => void;
  locked?: boolean;
}

const AssessmentSummaryCard: React.FC<AssessmentSummaryCardProps> = ({
  summary,
  title,
  onContinue,
  locked = false,
}) => {
  const handleContinue = useCallback(() => {
    onContinue?.();
  }, [onContinue]);

  const isComplete = summary.status === 'COMPLETED';
  const heading = title || summary.title;

  return (
    <View
      style={styles.card}
      accessibilityLabel={`${heading} assessment card`}>

      <View style={styles.titleRow}>
        <AppText style={styles.title} numberOfLines={2}>
          {heading}
        </AppText>
        {summary.reviewStatus ? (
          <View
            style={[
              styles.reviewChip,
              summary.reviewStatus === 'approved' && styles.reviewChipApproved,
            ]}>
            <AppText style={styles.reviewChipText}>
              {summary.reviewStatus === 'in_review' ? 'In review' : 'Reviewed'}
            </AppText>
          </View>
        ) : (
          <AssessmentStatusBadge status={summary.status} />
        )}
      </View>

      <AppText style={styles.dateText}>
        {summary.surveyClosed
          ? "Opens once the program office locks the survey"
          : `Started on ${formatDate(summary.startedDateISO)}`}
      </AppText>

      <AppText style={styles.progressLabel}>Assessment Progress</AppText>

      <AssessmentProgressMeter
        progress={summary.progress}
        isComplete={isComplete}
        backgroundColor={COLORS.gray300}
      />

      <View style={styles.fractionRow}>
        <AppText style={styles.fractionCount} color={COLORS.gray900}>
          {summary.completedQuestions}
        </AppText>
        <AppText style={styles.fractionDivider} color={COLORS.gray500}>
          {' '}/{' '}
        </AppText>
        <AppText style={styles.fractionTotal} color={COLORS.gray700}>
          {summary.totalQuestions} Questions Completed
        </AppText>
      </View>

      <Button
        title={summary.buttonTitle}
        onPress={handleContinue}
        variant={locked ? 'outline' : 'primary'}
        size="lg"
        leftIcon={
          locked ? (
            <AppIcon
              name={ICONS.LOCK}
              size={moderateScale(18)}
              color={COLORS.primary}
            />
          ) : undefined
        }
      />
    </View>
  );
};

export default React.memo(AssessmentSummaryCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
    flex: 1,
  },
  dateText: {
    ...presets.bodyXS,
    color: COLORS.gray500,
    marginTop: -spacing[1],
  },
  progressLabel: {
    ...presets.labelSM,
    color: COLORS.gray700,
  },
  fractionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  fractionCount: {
    ...presets.headingMD,
  },
  fractionDivider: {
    ...presets.bodySM,
  },
  fractionTotal: {
    ...presets.bodySM,
  },
  reviewChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    backgroundColor: addAlpha(COLORS.gray500, 0.14),
  },
  reviewChipApproved: {
    backgroundColor: addAlpha(COLORS.success, 0.14),
  },
  reviewChipText: {
    ...presets.labelSM,
    color: COLORS.gray700,
  },
});
