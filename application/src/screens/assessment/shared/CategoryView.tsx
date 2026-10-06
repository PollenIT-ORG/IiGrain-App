import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
import { showSuccess, showToast } from '../../../services/toastService';
import AssessmentLockedModal from '../../../components/assessment/AssessmentLockedModal';
import CategorySummaryCard from '../../../components/assessment/CategorySummaryCard';
import QuestionCard from '../../../components/assessment/QuestionCard';
import SectionHeader from '../../../components/assessment/SectionHeader';
import CategoryFormView from './CategoryFormView';
import CategoryRecordsView from './CategoryRecordsView';
import { questionsForRecord, recordLabel } from '../../../utils/recordAnswers';
import type { AssessmentQuestion, SaveFormAnswerInput } from '../../../types/assessment';
import { toCategoryHeaderModel, toQuestionCardItem } from '../assessmentPresenter';
import { styles } from '../AssessmentCategoryScreenStyle';
import { useAssessmentFlow } from './useAssessmentFlow';
import type {
  AssessmentRole,
  FlowNavigation,
  SaveCategoryAnswersResult,
} from './flowTypes';

const MAX_RECORDS = 50;

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
    categoryForm: form,
    loadingCategoryForm: loading,
    savingCategoryForm,
    error,
    loadedSummaryScope,
    loadSummary,
    loadCategoryForm,
    addCategoryRecord,
    saveCategoryRecord,
    deleteCategoryRecord,
  } = flow;

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [openedNumber, setOpenedNumber] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const gated = access.locked && access.resolved && !submitted;
  const [lockedOpen, setLockedOpen] = useState(false);

  useEffect(() => {
    if (gated) {
      setLockedOpen(true);
    }
  }, [gated]);

  const ready = !!form && form.category.id === categoryId;

  const load = useCallback(() => {
    loadCategoryForm({ programId, fieldId, categoryId });
  }, [loadCategoryForm, programId, fieldId, categoryId]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) {
        load();
      }
    }, [ready, load]),
  );

  useFocusEffect(
    useCallback(() => {
      if (loadedSummaryScope !== `${programId}:${fieldId}`) {
        loadSummary({ programId, fieldId });
      }
    }, [loadSummary, loadedSummaryScope, programId, fieldId]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCategoryForm({ programId, fieldId, categoryId });
    setRefreshing(false);
  }, [loadCategoryForm, programId, fieldId, categoryId]);

  const header = useMemo(
    () => (ready && form ? toCategoryHeaderModel(form) : null),
    [ready, form],
  );
  const questionCards = useMemo(
    () =>
      ready && form ? form.questions.map((q, i) => toQuestionCardItem(q, i + 1, categoryId)) : [],
    [ready, form, categoryId],
  );
  const summaryKind = summary?.assessment.questionKind;
  const kind = ready && form ? form.questionKind ?? summaryKind ?? 'mcq' : 'mcq';

  const records = useMemo(() => (ready && form ? form.records : []), [ready, form]);
  const editingRecord = useMemo(
    () => (editingRecordId ? records.find(r => r.id === editingRecordId) ?? null : null),
    [records, editingRecordId],
  );
  const recordQuestions = useMemo(
    () => (form ? questionsForRecord(form.questions, editingRecord) : []),
    [form, editingRecord],
  );
  const recordCategoryName = header?.category.title || categoryName;
  const openRecordLabel = recordLabel(
    recordCategoryName,
    editingRecord?.number ?? openedNumber,
  );

  const reportSaveProblem = useCallback((result: SaveCategoryAnswersResult) => {
    if (result.closed) {
      showToast(
        "This program's assessment is not open yet. It opens once the program office locks the survey.",
        { type: 'error' },
      );
      return;
    }
    showToast(result.message ?? 'Could not save this form. Please try again.', {
      type: 'error',
    });
  }, []);

  const openRecord = useCallback(
    (recordId: string | null) => {
      if (recordId === null && records.length >= MAX_RECORDS) {
        showToast(`You can add up to ${MAX_RECORDS} here.`, { type: 'error' });
        return;
      }
      const existing = recordId ? records.find(r => r.id === recordId) : undefined;
      setOpenedNumber(existing?.number ?? records.length + 1);
      setEditingRecordId(recordId);
      setFormOpen(true);
    },
    [records],
  );

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingRecordId(null);
  }, []);

  const handleSaveForm = useCallback(
    async (answers: SaveFormAnswerInput[]) => {
      const result = editingRecordId
        ? await saveCategoryRecord({
            programId,
            fieldId,
            categoryId,
            recordId: editingRecordId,
            answers,
          })
        : await addCategoryRecord({ programId, fieldId, categoryId, answers });
      if (!result.ok) {
        reportSaveProblem(result);
      }
      return result.ok;
    },
    [
      addCategoryRecord,
      saveCategoryRecord,
      editingRecordId,
      programId,
      fieldId,
      categoryId,
      reportSaveProblem,
    ],
  );

  const handleDeleteRecord = useCallback(
    async (recordId: string) => {
      const removed = records.find(r => r.id === recordId);
      setDeletingId(recordId);
      const result = await deleteCategoryRecord({ programId, fieldId, categoryId, recordId });
      setDeletingId(null);
      if (result.ok) {
        showSuccess(
          removed ? `${recordLabel(recordCategoryName, removed.number)} removed` : 'Removed',
        );
        return;
      }
      reportSaveProblem(result);
    },
    [
      deleteCategoryRecord,
      programId,
      fieldId,
      categoryId,
      reportSaveProblem,
      records,
      recordCategoryName,
    ],
  );

  const handleFormDone = useCallback(() => {
    closeForm();
  }, [closeForm]);

  const headerTitle = formOpen ? openRecordLabel : categoryName;

  const handleBack = useCallback(() => {
    if (formOpen) {
      closeForm();
      return;
    }
    navigation.goBack();
  }, [formOpen, closeForm, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (!formOpen) {
        return undefined;
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        closeForm();
        return true;
      });
      return () => sub.remove();
    }, [formOpen, closeForm]),
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
          <AppText style={styles.stateTitle}>
            {access.state === 'program_not_open' ? 'Opens soon' : 'Assessment locked'}
          </AppText>
          <AppText style={styles.stateMessage}>
            {access.state === 'program_not_open'
              ? "This assessment opens once the program office locks the survey — you'll be notified."
              : `You can score ${summary?.field.name ?? 'this field'} once you are on it and the visit is marked as arrived.`}
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

    if (!header || !form) {
      return renderLoading();
    }

    if (kind === 'input') {
      if (!formOpen) {
        return (
          <CategoryRecordsView
            categoryName={recordCategoryName}
            questions={form.questions}
            records={records}
            locked={submitted}
            busy={savingCategoryForm || deletingId !== null}
            onOpen={openRecord}
            onDelete={handleDeleteRecord}
          />
        );
      }
      return (
        <CategoryFormView
          key={editingRecordId ?? 'new'}
          title={openRecordLabel}
          questions={recordQuestions}
          locked={submitted}
          saving={savingCategoryForm}
          onSave={handleSaveForm}
          onDone={handleFormDone}
        />
      );
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
      <AppHeader variant="back" title={headerTitle} onBack={handleBack} />
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
