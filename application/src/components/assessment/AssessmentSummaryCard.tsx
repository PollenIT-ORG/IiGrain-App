import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { formatDate } from '../../utils';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';
import type { AssessmentSummary } from '../../types/assessment';
import AssessmentProgressBar from './AssessmentProgressBar';
import AssessmentStatusBadge from './AssessmentStatusBadge';

export interface AssessmentSummaryCardProps {
  summary: AssessmentSummary;
  title?: string;
  onContinue?: () => void;
}

const AssessmentSummaryCard: React.FC<AssessmentSummaryCardProps> = ({
  summary,
  title,
  onContinue,
}) => {
  const handleContinue = useCallback(() => {
    onContinue?.();
  }, [onContinue]);

  return (
    <View
      style={styles.card}
      accessibilityLabel={`${title} assessment card`}>

      <View style={styles.titleRow}>
        <AppText style={styles.title} numberOfLines={2}>
          {title ? title : summary.title}
        </AppText>
        <AssessmentStatusBadge status={summary.status} />
      </View>

      <AppText style={styles.dateText}>
        Started on {formatDate(summary.startedDateISO)}
      </AppText>

      <View style={styles.fractionRow}>
        <AppText style={styles.fractionCount} color={COLORS.gray900}>
          {summary.completedQuestions}
        </AppText>
        <AppText style={styles.fractionDivider} color={COLORS.gray500}>
          {' '}/{' '}
        </AppText>
        <AppText style={styles.fractionTotal} color={COLORS.gray700}>
          {summary.totalQuestions} Completed
        </AppText>
      </View>

      <AssessmentProgressBar
        progress={summary.progress}
        backgroundColor={COLORS.gray300}
      />

      <Button
        title={summary.buttonTitle}
        onPress={handleContinue}
        variant="primary"
        size="lg"
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
});
