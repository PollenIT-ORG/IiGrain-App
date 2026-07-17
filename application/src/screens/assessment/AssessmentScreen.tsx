import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AnimatedTabBar, AppHeader, AppText, Button, TabItem } from '../../components';
import {
  AppShimmer,
  AppShimmerButton,
  AppShimmerCard,
  AppShimmerChip,
  AppShimmerList,
  AppShimmerText,
} from '../../components/Shimmer';
import { EmptyState } from '../../components/farms';
import AssessmentFieldCard from '../../components/assessment/AssessmentFieldCard';
import EmptyAssessmentState from '../../components/assessment/EmptyAssessmentState';
import AssessmentSummaryCard from '../../components/assessment/AssessmentSummaryCard';
import CategoryProgressList from '../../components/assessment/CategoryProgressList';
import SectionHeader from '../../components/assessment/SectionHeader';
import { COLORS, borderRadius, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchAssessmentSummaryThunk,
  refreshAssessmentSummaryThunk,
  fetchMyAssessmentFieldsThunk,
  selectAssessmentCategories,
  selectAssessmentError,
  selectAssessmentRefreshing,
  selectAssessmentSummary,
  selectMyAssessments,
  selectMyFieldsLoading,
} from '../../redux/slices/assessmentSlice';
import { selectResumePoint } from '../../redux/slices/assessmentProgressSlice';
import type { AssessmentCategory } from '../../types/assessment';
import type {
  AppStackParamList,
  AppTabParamList,
} from '../../navigation/navigationTypes';
import { isAssessmentComplete, toCategoryItems, toSummaryCardModel } from './assessmentPresenter';
import { styles } from './AssessmentScreenStyle';

type AssessmentTab = 'myassessment' | 'history';

const TABS: TabItem<AssessmentTab>[] = [
  { key: 'myassessment', label: 'My Assessment' },
  { key: 'history', label: 'History' },
];

const AssessmentScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppTabParamList, 'Assessment'>>();
  const dispatch = useAppDispatch();

  const myAssessments = useAppSelector(selectMyAssessments);
  const myFieldsLoading = useAppSelector(selectMyFieldsLoading);

  const summary = useAppSelector(selectAssessmentSummary);
  const categories = useAppSelector(selectAssessmentCategories);
  const refreshing = useAppSelector(selectAssessmentRefreshing);
  const error = useAppSelector(selectAssessmentError);

  const [activeTab, setActiveTab] = useState<AssessmentTab>('myassessment');
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>(
    route.params?.fieldId,
  );

  useEffect(() => {
    dispatch(fetchMyAssessmentFieldsThunk());
  }, [dispatch]);

  useEffect(() => {
    if (route.params?.fieldId) {
      setSelectedFieldId(route.params.fieldId);
      navigation.setParams({ fieldId: undefined });
    }
  }, [route.params?.fieldId, navigation]);

  const summaryReady = !!summary && summary.field.id === selectedFieldId;
  useEffect(() => {
    if (selectedFieldId && !summaryReady) {
      dispatch(fetchAssessmentSummaryThunk(selectedFieldId));
    }
  }, [dispatch, selectedFieldId, summaryReady]);

  const handleTabChange = useCallback((tab: AssessmentTab) => setActiveTab(tab), []);

  const onSelectField = useCallback((id: string) => setSelectedFieldId(id), []);
  const onBackToList = useCallback(() => setSelectedFieldId(undefined), []);
  const onRefreshList = useCallback(
    () => dispatch(fetchMyAssessmentFieldsThunk()),
    [dispatch],
  );

  const onRefreshSummary = useCallback(() => {
    if (selectedFieldId) {
      dispatch(refreshAssessmentSummaryThunk(selectedFieldId));
    }
  }, [dispatch, selectedFieldId]);

  const onRetrySummary = useCallback(() => {
    if (selectedFieldId) {
      dispatch(fetchAssessmentSummaryThunk(selectedFieldId));
    }
  }, [dispatch, selectedFieldId]);

  const onOpenHistory = useCallback(
    (id: string) => {
      navigation.navigate('AssessmentReview', { fieldId: id, locked: true });
    },
    [navigation],
  );

  const summaryCard = useMemo(
    () => (summary ? toSummaryCardModel(summary) : null),
    [summary],
  );
  const categoryItems = useMemo(() => toCategoryItems(categories), [categories]);

  const handleCategoryPress = useCallback(
    (category: AssessmentCategory) => {
      if (!selectedFieldId) {
        return;
      }
      navigation.navigate('AssessmentCategory', {
        fieldId: selectedFieldId,
        categoryId: category.id,
        categoryName: category.title,
      });
    },
    [navigation, selectedFieldId],
  );

  const isComplete = useMemo(
    () => (summary ? isAssessmentComplete(summary) : false),
    [summary],
  );

  const resumePoint = useAppSelector(selectResumePoint(selectedFieldId));

  const handlePrimaryCta = useCallback(() => {
    if (!selectedFieldId) {
      return;
    }
    if (isComplete) {
      navigation.navigate('AssessmentReview', { fieldId: selectedFieldId });
      return;
    }
    if (resumePoint) {
      const savedCat = categories.find(c => c.id === resumePoint.categoryId);
      if (savedCat && savedCat.answered < savedCat.totalQuestions) {
        navigation.navigate('AssessmentQuestionDetail', {
          fieldId: selectedFieldId,
          categoryId: savedCat.id,
          questionId: resumePoint.questionId,
        });
        return;
      }
    }
    const target = categories.find(c => c.answered < c.totalQuestions) ?? categories[0];
    if (target) {
      navigation.navigate('AssessmentCategory', {
        fieldId: selectedFieldId,
        categoryId: target.id,
        categoryName: target.name,
      });
    }
  }, [selectedFieldId, isComplete, navigation, categories, resumePoint]);

  const renderCount = (label: string, value: number, color: string) => (
    <View style={styles.countChip}>
      <AppText style={[styles.countValue, { color }]}>{value}</AppText>
      <AppText style={styles.countLabel}>{label}</AppText>
    </View>
  );

  const renderFieldCardSkeleton = (key: number) => (
    <AppShimmerCard key={key} style={skStyles.cardGap}>
      <View style={skStyles.rowGap}>
        <AppShimmer width={scale(40)} height={scale(40)} radius={borderRadius.md} />
        <View style={skStyles.rowBody}>
          <AppShimmerText width="60%" height={moderateScale(14)} />
          <AppShimmerText width="40%" height={moderateScale(11)} />
        </View>
        <AppShimmerChip width={scale(72)} />
      </View>
      <AppShimmer width="100%" height={scale(8)} radius={borderRadius.full} />
      <AppShimmerText width={scale(90)} height={moderateScale(11)} />
    </AppShimmerCard>
  );

  const renderListSkeleton = () => (
    <View style={styles.body}>
      <View style={styles.landingHeader}>
        <AppShimmerText width="55%" height={moderateScale(18)} />
        <AppShimmerText width={scale(56)} height={moderateScale(11)} />
      </View>
      <View style={styles.countsRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.countChip}>
            <AppShimmer width={scale(28)} height={moderateScale(20)} />
            <AppShimmerText width="70%" height={moderateScale(10)} />
          </View>
        ))}
      </View>
      {[0, 1, 2].map(i => renderFieldCardSkeleton(i))}
    </View>
  );

  const renderSummarySkeleton = () => (
    <View style={styles.body}>
      <View style={styles.backRow}>
        <AppShimmer width={scale(20)} height={scale(20)} radius={borderRadius.full} />
        <AppShimmerText width={scale(120)} height={moderateScale(12)} />
      </View>
      <AppShimmerText width="60%" height={moderateScale(12)} />

      <AppShimmerCard style={skStyles.cardGap}>
        <View style={skStyles.titleRow}>
          <AppShimmerText width="55%" height={moderateScale(16)} />
          <AppShimmerChip width={scale(80)} />
        </View>
        <AppShimmerText width="45%" height={moderateScale(11)} />
        <AppShimmerText width={scale(120)} height={moderateScale(20)} />
        <AppShimmer width="100%" height={scale(8)} radius={borderRadius.full} />
        <AppShimmerButton />
      </AppShimmerCard>

      <View style={styles.section}>
        <AppShimmerText width={scale(120)} height={moderateScale(14)} />
        <View style={styles.categoriesCard}>
          <AppShimmerList
            count={4}
            renderItem={() => (
              <View style={skStyles.categoryRow}>
                <AppShimmer width={scale(36)} height={scale(36)} radius={borderRadius.md} />
                <View style={skStyles.rowBody}>
                  <AppShimmerText width="55%" height={moderateScale(13)} />
                  <AppShimmer width="100%" height={scale(6)} radius={borderRadius.full} />
                </View>
              </View>
            )}
          />
        </View>
      </View>
    </View>
  );

  const renderError = (message: string, onRetry: () => void) => (
    <View style={styles.stateCenter}>
      <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
      <AppText style={styles.stateTitle}>Couldn't load</AppText>
      <AppText style={styles.stateMessage}>{message}</AppText>
      <Button title="Retry" onPress={onRetry} fullWidth={false} style={styles.retryBtn} />
    </View>
  );

  const renderFieldList = () => {
    if (myFieldsLoading && !myAssessments) {
      return renderListSkeleton();
    }
    if (error && !myAssessments) {
      return renderError(error, onRefreshList);
    }
    const data = myAssessments;
    if (!data) {
      return renderListSkeleton();
    }
    return (
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={myFieldsLoading && !!myAssessments}
            onRefresh={onRefreshList}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        <View style={styles.landingHeader}>
          <AppText style={styles.landingTitle}>{data.title || 'My Assessments'}</AppText>
          <AppText style={styles.landingCount}>
            {data.counts.total} field{data.counts.total === 1 ? '' : 's'}
          </AppText>
        </View>

        <View style={styles.countsRow}>
          {renderCount('In Progress', data.counts.inProgress, COLORS.primary)}
          {renderCount('Completed', data.counts.completed, COLORS.success)}
          {renderCount('Not Started', data.counts.notStarted, COLORS.gray500)}
        </View>

        {data.fields.length > 0 ? (
          data.fields.map(f => (
            <AssessmentFieldCard key={f.fieldId} item={f} onPress={onSelectField} />
          ))
        ) : (
          <EmptyState
            icon="clipboard-text-outline"
            title="No fields to assess"
            message="Add a field to your farm to start an assessment."
          />
        )}
      </ScrollView>
    );
  };

  const renderFieldSummary = () => {
    if (error && !summaryReady) {
      return renderError(error, onRetrySummary);
    }
    if (!summary || !summaryCard || !summaryReady) {
      return renderSummarySkeleton();
    }
    return (
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefreshSummary}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        <Pressable onPress={onBackToList} style={styles.backRow} hitSlop={8}>
          <AppIcon name={ICONS.CHEVRON_LEFT} size={moderateScale(20)} color={COLORS.primary} />
          <AppText style={styles.backText}>All assessments</AppText>
        </Pressable>

        <AppText style={styles.fieldCaption}>
          {summary.field.name} · {summary.field.farmName}
        </AppText>

        <AssessmentSummaryCard summary={summaryCard} onContinue={handlePrimaryCta} />

        <View style={styles.section}>
          <SectionHeader title="Categories" />
          {categoryItems.length > 0 ? (
            <View style={styles.categoriesCard}>
              <CategoryProgressList
                categories={categoryItems}
                onCategoryPress={handleCategoryPress}
              />
            </View>
          ) : (
            <EmptyState
              icon="clipboard-text-outline"
              title="No categories yet"
              message="This assessment has no categories to show."
            />
          )}
        </View>
      </ScrollView>
    );
  };

  const renderHistory = () => {
    if (myFieldsLoading && !myAssessments) {
      return renderListSkeleton();
    }
    const completed = myAssessments?.fields.filter(f => !!f.submittedAtISO) ?? [];
    if (completed.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={myFieldsLoading && !!myAssessments}
              onRefresh={onRefreshList}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }>
          <EmptyAssessmentState
            icon="clipboard-check-outline"
            title="No History Yet"
            message="Completed assessments will appear here once you submit your first evaluation."
          />
        </ScrollView>
      );
    }
    return (
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={myFieldsLoading && !!myAssessments}
            onRefresh={onRefreshList}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        {completed.map(f => (
          <AssessmentFieldCard key={f.fieldId} item={f} onPress={onOpenHistory} />
        ))}
      </ScrollView>
    );
  };

  const renderMyAssessment = () =>
    selectedFieldId ? renderFieldSummary() : renderFieldList();

  return (
    <View style={styles.safe}>
      <AppHeader variant="title" title="Assessments" showDrawer rightActions={['add']} />

      <AnimatedTabBar
        tabs={TABS}
        activeKey={activeTab}
        onTabChange={handleTabChange}
        style={styles.tabBar}
      />

      {activeTab === 'myassessment' ? renderMyAssessment() : renderHistory()}
    </View>
  );
};

export default AssessmentScreen;

const skStyles = StyleSheet.create({
  cardGap: { gap: spacing[3] },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rowBody: { flex: 1, gap: spacing[1.5] },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
});
