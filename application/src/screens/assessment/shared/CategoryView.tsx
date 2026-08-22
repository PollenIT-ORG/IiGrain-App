import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../../components';
import {
  AppShimmer,
  AppShimmerCard,
  AppShimmerChip,
  AppShimmerList,
  AppShimmerText,
} from '../../../components/Shimmer';
import { COLORS, borderRadius, spacing } from '../../../constants';
import { moderateScale, scale } from '../../../utils';
import AssessmentLockedModal from '../../../components/assessment/AssessmentLockedModal';
import CategorySummaryCard from '../../../components/assessment/CategorySummaryCard';
import QuestionCard from '../../../components/assessment/QuestionCard';
import SectionHeader from '../../../components/assessment/SectionHeader';
import type { AssessmentQuestion } from '../../../types/assessment';
import { toCategoryHeaderModel, toQuestionCardItem } from '../assessmentPresenter';
import { styles } from '../AssessmentCategoryScreenStyle';
import { useAssessmentFlow } from './useAssessmentFlow';
import type { AssessmentRole, FlowNavigation } from './flowTypes';

export interface CategoryViewProps {
  role: AssessmentRole;
  params: {
    programId: string;
    fieldId: string;
    categoryId: string;
    categoryName: string;
  };
  navigation: FlowNavigation;
}

const CategoryView: React.FC<CategoryViewProps> = ({ role, params, navigation }) => {
  const { programId, fieldId, categoryId, categoryName } = params;
  const flow = useAssessmentFlow(role, programId, fieldId);

  const {
    routes,
    access,
    submitted,
    summary,
    categoryList: list,
    questions,
    loadingQuestions: loading,
    error,
    loadCategoryQuestions,
  } = flow;

  const [refreshing, setRefreshing] = useState(false);

  const gated = access.locked && access.resolved && !submitted;
  const [lockedOpen, setLockedOpen] = useState(false);

  useEffect(() => {
    if (gated) {
      setLockedOpen(true);
    }
  }, [gated]);

  const ready = !!list && list.category.id === categoryId;

  const load = useCallback(() => {
    loadCategoryQuestions({ programId, fieldId, categoryId });
  }, [loadCategoryQuestions, programId, fieldId, categoryId]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) {
        load();
      }
    }, [ready, load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCategoryQuestions({ programId, fieldId, categoryId });
    setRefreshing(false);
  }, [loadCategoryQuestions, programId, fieldId, categoryId]);

  const header = useMemo(
    () => (ready && list ? toCategoryHeaderModel(list) : null),
    [ready, list],
  );
  const questionCards = useMemo(
    () => questions.map((q, i) => toQuestionCardItem(q, i + 1, categoryId)),
    [questions, categoryId],
  );

  const openQuestion = useCallback(
    (question: AssessmentQuestion) => {
      navigation.navigate(routes.question, {
        programId,
        fieldId,
        categoryId,
        questionId: question.id,
      });
    },
    [navigation, routes, programId, fieldId, categoryId],
  );

  const renderLoading = () => (
    <View style={styles.body}>
      <AppShimmerCard>
        <View style={styles.section}>
          <View style={skStyles.rowGap}>
            <AppShimmer width={scale(40)} height={scale(40)} radius={borderRadius.full} />
            <AppShimmerText
              width="55%"
              height={moderateScale(16)}
              style={skStyles.flex1}
            />
            <AppShimmerChip width={scale(84)} />
          </View>
          <AppShimmerText width={scale(120)} height={moderateScale(18)} />
          <AppShimmer width="100%" height={scale(8)} radius={borderRadius.full} />
          <View style={skStyles.rowGapTop}>
            <AppShimmer width="30%" height={moderateScale(14)} />
            <AppShimmer width="30%" height={moderateScale(14)} />
            <AppShimmer width="30%" height={moderateScale(14)} />
          </View>
        </View>
      </AppShimmerCard>

      <View style={styles.section}>
        <AppShimmerText width={scale(140)} height={moderateScale(14)} />
        <AppShimmerList
          count={4}
          renderItem={() => (
            <AppShimmerCard>
              <View style={skStyles.rowGap}>
                <AppShimmer width={scale(40)} height={scale(40)} radius={borderRadius.md} />
                <View style={skStyles.rowBody}>
                  <AppShimmerText width="70%" height={moderateScale(13)} />
                  <AppShimmerText count={2} width="100%" lastLineWidth="80%" />
                  <AppShimmerChip width={scale(70)} />
                </View>
              </View>
            </AppShimmerCard>
          )}
        />
      </View>
    </View>
  );

  const renderBody = () => {
    if (gated) {
      return (
        <View style={styles.stateCenter}>
          <View style={gateStyles.badge}>
            <AppIcon name={ICONS.LOCK} size={moderateScale(30)} color={COLORS.accent} />
          </View>
          <AppText style={styles.stateTitle}>Assessment locked</AppText>
          <AppText style={styles.stateMessage}>
            You can score {summary?.field.name ?? 'this field'} once you are on it
            and the visit is marked as arrived.
          </AppText>
          <Button
            title="What do I need to do?"
            onPress={() => setLockedOpen(true)}
            fullWidth={false}
            style={styles.retryBtn}
          />
        </View>
      );
    }

    if (loading && !ready) {
      return renderLoading();
    }

    if (error && !ready) {
      return (
        <View style={styles.stateCenter}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load category</AppText>
          <AppText style={styles.stateMessage}>{error}</AppText>
          <Button title="Retry" onPress={load} fullWidth={false} style={styles.retryBtn} />
        </View>
      );
    }

    if (!header) {
      return renderLoading();
    }

    return (
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
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
            <AppText style={styles.stateMessage}>No questions in this category yet.</AppText>
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title={categoryName} onBack={() => navigation.goBack()} />
      {renderBody()}

      {access.state !== 'open' ? (
        <AssessmentLockedModal
          visible={lockedOpen}
          state={access.state}
          fieldName={summary?.field.name}
          otherFieldName={access.otherFieldName}
          onOpenVisit={
            access.visitId
              ? () => navigation.navigate('AssessorVisit', { visitId: access.visitId })
              : undefined
          }
          onClose={() => setLockedOpen(false)}
        />
      ) : null}
    </View>
  );
};

export default CategoryView;

const gateStyles = StyleSheet.create({
  badge: {
    width: scale(64),
    height: scale(64),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const skStyles = StyleSheet.create({
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rowGapTop: { flexDirection: 'row', gap: spacing[3] },
  rowBody: { flex: 1, gap: spacing[1.5] },
  flex1: { flex: 1 },
});
