import React, { useCallback, useEffect, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import { EmptyState } from '../../components/farms';
import AssessmentSummaryCard from '../../components/assessment/AssessmentSummaryCard';
import CategoryProgressList from '../../components/assessment/CategoryProgressList';
import SectionHeader from '../../components/assessment/SectionHeader';
import SoilInfoCard from '../../components/farms/SoilInfoCard';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchAssessorSummaryThunk,
  refreshAssessorSummaryThunk,
  selectAssessorCategories,
  selectAssessorError,
  selectAssessorLocked,
  selectAssessorRefreshing,
  selectAssessorSubmittedBy,
  selectAssessorSummary,
  selectAssessorSummaryLoading,
} from '../../redux/slices/assessorSlice';
import { toCategoryItems, toSummaryCardModel } from '../assessment/assessmentPresenter';
import {
  AppShimmer,
  AppShimmerButton,
  AppShimmerCard,
  AppShimmerList,
  AppShimmerRow,
  AppShimmerSection,
  AppShimmerText,
} from '../../components/Shimmer';
import type { AssessmentCategory } from '../../types/assessment';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const AssessorAssessmentSummaryScreen: React.FC<AssessorScreenProps<'AssessorAssessmentSummary'>> = ({
  route,
  navigation,
}) => {
  const { fieldId, fieldName } = route.params;
  const dispatch = useAppDispatch();

  const summary = useAppSelector(selectAssessorSummary);
  const categories = useAppSelector(selectAssessorCategories);
  const locked = useAppSelector(selectAssessorLocked);
  const submittedBy = useAppSelector(selectAssessorSubmittedBy);
  const loading = useAppSelector(selectAssessorSummaryLoading);
  const refreshing = useAppSelector(selectAssessorRefreshing);
  const error = useAppSelector(selectAssessorError);

  const ready = !!summary && summary.field.id === fieldId;

  useEffect(() => {
    dispatch(fetchAssessorSummaryThunk(fieldId));
  }, [dispatch, fieldId]);

  const onRefresh = useCallback(() => dispatch(refreshAssessorSummaryThunk(fieldId)), [dispatch, fieldId]);

  const summaryCard = useMemo(() => (ready && summary ? toSummaryCardModel(summary) : null), [ready, summary]);
  const categoryItems = useMemo(() => toCategoryItems(categories), [categories]);

  const openCategory = useCallback(
    (category: AssessmentCategory) =>
      navigation.navigate('AssessorCategory', { fieldId, categoryId: category.id, categoryName: category.title }),
    [navigation, fieldId],
  );
  const allAnswered =
    !!summary && summary.assessment.totalQuestions > 0 && summary.assessment.answered >= summary.assessment.totalQuestions;

  const handlePrimaryCta = useCallback(() => {
    if (allAnswered) {
      navigation.navigate('AssessorReview', { fieldId });
      return;
    }
    const target = categories.find(c => c.answered < c.totalQuestions) ?? categories[0];
    if (target) {
      navigation.navigate('AssessorCategory', {
        fieldId,
        categoryId: target.id,
        categoryName: target.name,
      });
    }
  }, [allAnswered, categories, navigation, fieldId]);

  const loadingSkeleton = (
    <View style={styles.safe}>
      <AppHeader variant="back" title={fieldName ?? 'Assessment'} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <AppShimmer width="60%" height={moderateScale(14)} radius={borderRadius.sm} style={styles.loadingCaption} />
        <AppShimmerCard>
          <AppShimmerText count={2} width="75%" lastLineWidth="50%" />
          <AppShimmerButton style={styles.loadingCardBtn} />
        </AppShimmerCard>
        <AppShimmerSection titleWidth="35%" style={styles.section}>
          <AppShimmerList count={5} renderItem={() => <AppShimmerRow lines={2} showTrailing />} />
        </AppShimmerSection>
      </View>
    </View>
  );

  if (loading && !ready) {
    return loadingSkeleton;
  }

  if (error && !ready) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title={fieldName ?? 'Assessment'} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load assessment</AppText>
          <AppText style={styles.muted}>{error}</AppText>
          <Button title="Retry" onPress={() => dispatch(fetchAssessorSummaryThunk(fieldId))} fullWidth={false} style={styles.retry} />
        </View>
      </View>
    );
  }

  if (!summary || !summaryCard) {
    return loadingSkeleton;
  }

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title={summary.field.name} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }>
        <AppText style={styles.caption}>{summary.field.name} · {summary.field.farmName}</AppText>

        {locked ? (
          <View style={styles.lockBanner}>
            <AppIcon name={ICONS.LOCK_CHECK} size={moderateScale(18)} color={COLORS.primary} />
            <AppText style={styles.lockText}>
              Submitted by {submittedBy?.role === 'assessor' ? 'Assessor' : 'Farmer'} - read-only.
            </AppText>
          </View>
        ) : null}

        <AssessmentSummaryCard summary={summaryCard} onContinue={handlePrimaryCta} />

        <View style={styles.section}>
          <SectionHeader title="Categories" />
          {categoryItems.length > 0 ? (
            <View style={styles.categoriesCard}>
              <CategoryProgressList categories={categoryItems} onCategoryPress={openCategory} />
            </View>
          ) : (
            <EmptyState icon="clipboard-text-outline" title="No categories" message="This assessment has no categories." />
          )}
        </View>

        <SoilInfoCard fieldId={fieldId} />

        <View style={styles.compareRow}>
          <Button
            title="Farmer's answers"
            variant="outline"
            fullWidth={false}
            onPress={() =>
              navigation.navigate('AssessorFarmerAssessment', { fieldId, fieldName: summary.field.name })
            }
            leftIcon={<AppIcon name={ICONS.REVIEWER} size={moderateScale(18)} color={COLORS.primary} />}
            style={styles.compareBtn}
          />
          <Button
            title="Compare"
            variant="outline"
            fullWidth={false}
            onPress={() =>
              navigation.navigate('AssessorComparison', { fieldId, fieldName: summary.field.name })
            }
            leftIcon={<AppIcon name={ICONS.BALANCE} size={moderateScale(18)} color={COLORS.primary} />}
            style={styles.compareBtn}
          />
        </View>

        {!locked && allAnswered ? (
          <Button
            title="Review"
            onPress={() => navigation.navigate('AssessorReview', { fieldId })}
            leftIcon={<AppIcon name={ICONS.REVIEW} size={moderateScale(20)} color={COLORS.white} />}
            style={styles.reviewBtn}
          />
        ) : null}
      </ScrollView>
    </View>
  );
};

export default AssessorAssessmentSummaryScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  body: { padding: spacing[4], paddingBottom: spacing[10] },
  caption: { ...presets.bodySM, color: COLORS.gray700, marginBottom: spacing[3] },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  lockText: { ...presets.bodySM, color: COLORS.primaryDark, flexShrink: 1 },
  section: { marginTop: spacing[4] },
  loadingCaption: { marginBottom: spacing[3] },
  loadingCardBtn: { marginTop: spacing[3] },
  categoriesCard: { marginTop: spacing[2] },
  muted: { ...presets.bodySM, color: COLORS.gray500 },
  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4] },
  retry: { marginTop: spacing[4], minWidth: moderateScale(160) },
  compareRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[5] },
  compareBtn: { flex: 1 },
  reviewBtn: { marginTop: spacing[3] },
});
