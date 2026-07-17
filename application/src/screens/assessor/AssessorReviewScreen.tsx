import React, { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import {
  AppShimmer,
  AppShimmerCard,
  AppShimmerText,
} from '../../components/Shimmer';
import AssessmentSummaryCard from '../../components/assessment/AssessmentSummaryCard';
import SectionHeader from '../../components/assessment/SectionHeader';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../constants';
import { moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchAssessorSummaryThunk,
  selectAssessorCategories,
  selectAssessorLocked,
  selectAssessorSummary,
  selectAssessorSummaryLoading,
  selectAssessorSubmitting,
  submitAssessorAssessmentThunk,
} from '../../redux/slices/assessorSlice';
import { showSuccess, showToast } from '../../services/toastService';
import { toSummaryCardModel } from '../assessment/assessmentPresenter';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const AssessorReviewScreen: React.FC<AssessorScreenProps<'AssessorReview'>> = ({
  route,
  navigation,
}) => {
  const { fieldId } = route.params;
  const dispatch = useAppDispatch();

  const summary = useAppSelector(selectAssessorSummary);
  const categories = useAppSelector(selectAssessorCategories);
  const locked = useAppSelector(selectAssessorLocked);
  const submitting = useAppSelector(selectAssessorSubmitting);
  const loading = useAppSelector(selectAssessorSummaryLoading);

  const ready = !!summary && summary.field.id === fieldId;

  useEffect(() => {
    if (!ready) {
      dispatch(fetchAssessorSummaryThunk(fieldId));
    }
  }, [dispatch, fieldId, ready]);

  const summaryCard = useMemo(() => (ready && summary ? toSummaryCardModel(summary) : null), [ready, summary]);
  const allAnswered =
    !!summary && summary.assessment.totalQuestions > 0 && summary.assessment.answered >= summary.assessment.totalQuestions;

  const onSubmit = useCallback(async () => {
    if (!allAnswered) {
      showToast('Answer every question before submitting.', { type: 'error' });
      return;
    }
    const action = await dispatch(submitAssessorAssessmentThunk(fieldId));
    if (submitAssessorAssessmentThunk.fulfilled.match(action)) {
      showSuccess('Assessment submitted');
      navigation.goBack();
    }
  }, [allAnswered, dispatch, fieldId, navigation]);

  if (!ready || !summaryCard) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Review & Submit" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <AppShimmerCard>
            <AppShimmerText count={2} width="70%" lastLineWidth="45%" />
            <AppShimmer height={moderateScale(8)} radius={borderRadius.full} style={styles.loadingProgress} />
          </AppShimmerCard>
          <View style={styles.section}>
            <AppShimmer width="35%" height={moderateScale(14)} radius={borderRadius.sm} style={styles.loadingTitle} />
            <View style={styles.card}>
              {[0, 1, 2, 3].map((i, idx, arr) => (
                <View key={i} style={[styles.row, idx < arr.length - 1 && styles.rowDivider]}>
                  <AppShimmer width="55%" height={moderateScale(12)} radius={borderRadius.sm} />
                  <AppShimmer width={moderateScale(40)} height={moderateScale(12)} radius={borderRadius.sm} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Review & Submit" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <AssessmentSummaryCard summary={summaryCard} title="submitted" />

        <View style={styles.section}>
          <SectionHeader title="Categories" />
          <View style={styles.card}>
            {categories.map((c, i) => (
              <View key={c.id} style={[styles.row, i < categories.length - 1 && styles.rowDivider]}>
                <AppText style={styles.rowLabel} numberOfLines={1}>{c.name}</AppText>
                <AppText style={styles.rowValue}>{c.answered}/{c.totalQuestions}</AppText>
              </View>
            ))}
          </View>
        </View>

        {locked ? (
          <View style={styles.lockBanner}>
            <AppIcon name={ICONS.LOCK_CHECK} size={moderateScale(18)} color={COLORS.primary} />
            <AppText style={styles.lockText}>Submitted by Assessor - locked.</AppText>
          </View>
        ) : (
          <>
            <View style={styles.warn}>
              <AppIcon name={ICONS.INFO} size={moderateScale(16)} color={COLORS.accent} />
              <AppText style={styles.warnText}>After submit it locks and can no longer be edited.</AppText>
            </View>
            <Button
              title="Submit Assessment"
              onPress={onSubmit}
              loading={submitting}
              disabled={!allAnswered || loading}
              style={styles.submitBtn}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default AssessorReviewScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing[4], paddingBottom: spacing[10] },
  section: { marginTop: spacing[4] },
  loadingProgress: { marginTop: spacing[3] },
  loadingTitle: { marginBottom: spacing[2] },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    paddingHorizontal: spacing[4],
    marginTop: spacing[2],
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[3], gap: spacing[2] },
  rowDivider: { borderBottomWidth: borderWidth.hairline, borderBottomColor: COLORS.gray300 },
  rowLabel: { ...presets.labelMD, color: COLORS.gray900, flexShrink: 1 },
  rowValue: { ...presets.labelMD, color: COLORS.primary },
  lockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: COLORS.lightPrimary, borderRadius: borderRadius.lg, padding: spacing[3], marginTop: spacing[4],
  },
  lockText: { ...presets.bodySM, color: COLORS.primaryDark },
  warn: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[5], marginBottom: spacing[3] },
  warnText: { ...presets.bodySM, color: COLORS.gray700, flexShrink: 1 },
  submitBtn: { marginTop: spacing[1] },
});
