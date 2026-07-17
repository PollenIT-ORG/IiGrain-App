import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import type {
  AssessmentCategory,
  AssessmentProgress,
  AssessmentStatus,
} from '../../types/assessment';
import AssessmentProgressBar from './AssessmentProgressBar';
import AssessmentStatusBadge from './AssessmentStatusBadge';
import CategoryProgress from './CategoryProgress';

export interface CategorySummaryCardProps {
  category: AssessmentCategory;
  progress: AssessmentProgress;
}

const deriveStatus = (progress: AssessmentProgress): AssessmentStatus => {
  if (progress.total > 0 && progress.completed === progress.total) {
    return 'COMPLETED';
  }
  if (progress.completed > 0 || progress.inProgress > 0) {
    return 'IN_PROGRESS';
  }
  return 'PENDING';
};

const CategorySummaryCard: React.FC<CategorySummaryCardProps> = ({
  category,
  progress,
}) => (
  <View style={styles.card}>
    <View style={styles.titleRow}>
      <View style={styles.iconWrap}>
        <AppIcon name={category.icon} size={moderateScale(20)} color={COLORS.primary} />
      </View>
      <AppText style={styles.title} numberOfLines={2}>
        {category.title}
      </AppText>
      <AssessmentStatusBadge status={deriveStatus(progress)} />
    </View>

    <View style={styles.fractionRow}>
      <AppText style={styles.fractionCount} color={COLORS.gray900}>
        {progress.completed}
      </AppText>
      <AppText style={styles.fractionRest} color={COLORS.gray500}>
        {' '}/ {progress.total} Completed
      </AppText>
    </View>

    <AssessmentProgressBar progress={progress.percentage} />

    <CategoryProgress progress={progress} />
  </View>
);

export default React.memo(CategorySummaryCard);

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
    alignItems: 'center',
    gap: spacing[3],
  },
  iconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
    flex: 1,
  },
  fractionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  fractionCount: {
    ...presets.headingMD,
  },
  fractionRest: {
    ...presets.bodySM,
  },
});
