import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import {
  AppShimmer,
  AppShimmerCard,
  AppShimmerList,
  AppShimmerRow,
  AppShimmerSection,
  AppShimmerText,
} from '../../components/Shimmer';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { moderateScale } from '../../utils';
import CategorySummaryCard from '../../components/assessment/CategorySummaryCard';
import QuestionCard from '../../components/assessment/QuestionCard';
import SectionHeader from '../../components/assessment/SectionHeader';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchAssessorCategoryQuestionsThunk,
  selectAssessorCategoryQuestionList,
  selectAssessorError,
  selectAssessorQuestionList,
  selectAssessorQuestionsLoading,
} from '../../redux/slices/assessorSlice';
import { toCategoryHeaderModel, toQuestionCardItem } from '../assessment/assessmentPresenter';
import type { AssessmentQuestion } from '../../types/assessment';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const AssessorCategoryScreen: React.FC<AssessorScreenProps<'AssessorCategory'>> = ({
  route,
  navigation,
}) => {
  const { fieldId, categoryId, categoryName } = route.params;
  const dispatch = useAppDispatch();

  const list = useAppSelector(selectAssessorCategoryQuestionList);
  const questions = useAppSelector(selectAssessorQuestionList);
  const loading = useAppSelector(selectAssessorQuestionsLoading);
  const error = useAppSelector(selectAssessorError);

  const [refreshing, setRefreshing] = useState(false);
  const ready = !!list && list.category.id === categoryId;

  const load = useCallback(() => {
    dispatch(fetchAssessorCategoryQuestionsThunk({ fieldId, categoryId }));
  }, [dispatch, fieldId, categoryId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchAssessorCategoryQuestionsThunk({ fieldId, categoryId }));
    setRefreshing(false);
  }, [dispatch, fieldId, categoryId]);

  const header = useMemo(() => (ready && list ? toCategoryHeaderModel(list) : null), [ready, list]);
  const questionCards = useMemo(
    () => questions.map((q, i) => toQuestionCardItem(q, i + 1, categoryId)),
    [questions, categoryId],
  );

  const openQuestion = useCallback(
    (question: AssessmentQuestion) =>
      navigation.navigate('AssessorQuestion', { fieldId, categoryId, questionId: question.id }),
    [navigation, fieldId, categoryId],
  );

  const loadingSkeleton = (
    <View style={styles.body}>
      <AppShimmerCard>
        <AppShimmerText count={2} width="65%" lastLineWidth="45%" />
        <AppShimmer height={moderateScale(8)} radius={borderRadius.full} style={styles.loadingProgress} />
      </AppShimmerCard>
      <AppShimmerSection titleWidth="45%" style={styles.section}>
        <AppShimmerList count={5} renderItem={() => <AppShimmerRow lines={2} showTrailing />} />
      </AppShimmerSection>
    </View>
  );

  const renderBody = () => {
    if (loading && !ready) {
      return loadingSkeleton;
    }
    if (error && !ready) {
      return (
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load category</AppText>
          <AppText style={styles.muted}>{error}</AppText>
          <Button title="Retry" onPress={load} fullWidth={false} style={styles.retry} />
        </View>
      );
    }
    if (!header) {
      return loadingSkeleton;
    }
    return (
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }>
        <CategorySummaryCard category={header.category} progress={header.progress} />
        <View style={styles.section}>
          <SectionHeader title={`Questions (${questionCards.length})`} />
          {questionCards.length > 0 ? (
            <View style={styles.questionList}>
              {questionCards.map(question => (
                <QuestionCard key={question.id} question={question} onPress={openQuestion} />
              ))}
            </View>
          ) : (
            <AppText style={styles.muted}>No questions in this category yet.</AppText>
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title={categoryName} onBack={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default AssessorCategoryScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  body: { padding: spacing[4], paddingBottom: spacing[10] },
  section: { marginTop: spacing[4] },
  loadingProgress: { marginTop: spacing[3] },
  questionList: { marginTop: spacing[2] },
  muted: { ...presets.bodySM, color: COLORS.gray500 },
  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4] },
  retry: { marginTop: spacing[4], minWidth: moderateScale(160) },
});
