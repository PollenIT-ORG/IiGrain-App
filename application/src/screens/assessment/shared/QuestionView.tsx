import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import { AppHeader, AppText, AppTextInput, Button } from '../../../components';
import {
  AppShimmer,
  AppShimmerChip,
  AppShimmerInput,
  AppShimmerText,
} from '../../../components/Shimmer';
import { COLORS, borderRadius, spacing } from '../../../constants';
import { moderateScale, scale } from '../../../utils';
import SectionHeader from '../../../components/assessment/SectionHeader';
import QuestionHeader from '../../../components/assessment/QuestionHeader';
import AnswerInput from '../../../components/assessment/questionTypes/AnswerInput';
import QuestionFooter from '../../../components/assessment/QuestionFooter';
import EvidenceUploader, {
  type EvidenceMedia,
} from '../../../components/assessment/EvidenceUploader';
import AssessmentLockedModal from '../../../components/assessment/AssessmentLockedModal';
import CategoryCompleteModal from '../../../components/assessment/CategoryCompleteModal';
import { uploadEvidenceFile } from '../../../api/assessmentApi';
import { showSuccess, showToast } from '../../../services/toastService';
import type {
  AssessmentQuestionDetail,
  AssessmentQuestionListItem,
} from '../../../types/assessment';
import { buildAnswerPayload } from '../../../utils/answerPayload';
import {
  EMPTY_ANSWER_VALUE,
  answerValueFromDetail,
  hasAnswerValue,
  type AnswerLocalValue,
} from '../../../utils/answerValue';
import { styles } from '../AssessmentQuestionDetailScreenStyle';
import { useAssessmentFlow } from './useAssessmentFlow';
import type { AssessmentRole, FlowNavigation } from './flowTypes';

const COMMENT_MAX = 2000;

const EMPTY_QUESTIONS: AssessmentQuestionListItem[] = [];

const ANSWER_SECTION_TITLE: Record<string, { edit: string; view: string }> = {
  scored: { edit: 'Select Score', view: 'Score' },
  mcq: { edit: 'Select an Answer', view: 'Answer' },
  text: { edit: 'Your Answer', view: 'Answer' },
  long_text: { edit: 'Your Answer', view: 'Answer' },
  number: { edit: 'Enter a Number', view: 'Answer' },
  date: { edit: 'Select a Date', view: 'Answer' },
  boolean: { edit: 'Select Yes or No', view: 'Answer' },
};

const MISSING_ANSWER_MESSAGE: Record<string, string> = {
  scored: 'Please select a score to continue',
  mcq: 'Please choose an answer to continue',
  text: 'Please enter an answer to continue',
  long_text: 'Please enter an answer to continue',
  number: 'Please enter a number to continue',
  date: 'Please select a date to continue',
  boolean: 'Please select Yes or No to continue',
};

export const missingAnswerReason = (
  questionDetail: AssessmentQuestionDetail | null,
  answerValue: AnswerLocalValue,
  comment: string,
  evidenceUrls: string[],
): string => {
  if (!questionDetail) {
    return 'Please answer to continue';
  }
  if (!hasAnswerValue(questionDetail.questionType, answerValue)) {
    return MISSING_ANSWER_MESSAGE[questionDetail.questionType] ?? 'Please answer to continue';
  }
  if (questionDetail.commentMode === 'required' && !comment.trim()) {
    return 'Please add a description to continue';
  }
  if (questionDetail.evidenceMode === 'required' && evidenceUrls.length === 0) {
    return 'Please add a photo to continue';
  }
  return 'Please answer to continue';
};

type SavingAction = 'draft' | 'next' | null;

export interface QuestionViewProps {
  role: AssessmentRole;
  params: {
    programId: string;
    fieldId: string;
    categoryId: string;
    questionId: string;
  };
  navigation: FlowNavigation;
}

const QuestionView: React.FC<QuestionViewProps> = ({ role, params, navigation }) => {
  const { programId, fieldId, categoryId, questionId } = params;
  const insets = useSafeAreaInsets();
  const flow = useAssessmentFlow(role, programId, fieldId);

  const {
    access,
    submitted,
    questionDetail,
    categoryList,
    questions: loadedQuestions,
    loadingQuestion,
    saving,
    error,
    categories,
    summary,
    loadedSummaryScope,
    loadSummary,
    loadCategoryQuestions,
    loadQuestionDetail,
    saveAnswer,
    rememberResumePoint,
    goToFieldSummary,
  } = flow;

  const [answerValue, setAnswerValue] = useState<AnswerLocalValue>(EMPTY_ANSWER_VALUE);
  const [comment, setComment] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [savingAction, setSavingAction] = useState<SavingAction>(null);
  const [conflictNonce, setConflictNonce] = useState(0);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);

  const readOnly = submitted || !!questionDetail?.locked;
  const gated = access.locked && access.resolved && !readOnly;

  useEffect(() => {
    if (gated) {
      setLockedOpen(true);
    }
  }, [gated]);

  useEffect(() => {
    loadQuestionDetail({ programId, fieldId, categoryId, questionId });
  }, [loadQuestionDetail, programId, fieldId, categoryId, questionId]);

  useEffect(() => {
    rememberResumePoint({ programId, fieldId, categoryId, questionId });
  }, [rememberResumePoint, programId, fieldId, categoryId, questionId]);

  useFocusEffect(
    useCallback(() => {
      if (!categoryList || categoryList.category.id !== categoryId) {
        loadCategoryQuestions({ programId, fieldId, categoryId });
      }
    }, [loadCategoryQuestions, programId, fieldId, categoryId, categoryList]),
  );

  useFocusEffect(
    useCallback(() => {
      if (loadedSummaryScope !== `${programId}:${fieldId}`) {
        loadSummary({ programId, fieldId });
      }
    }, [loadSummary, programId, fieldId, loadedSummaryScope]),
  );

  const detailReady = !!questionDetail && questionDetail.id === questionId;

  useEffect(() => {
    setAnswerValue(EMPTY_ANSWER_VALUE);
    setComment('');
    setEvidenceUrls([]);
  }, [questionId]);

  useEffect(() => {
    if (questionDetail && questionDetail.id === questionId) {
      setAnswerValue(answerValueFromDetail(questionDetail));
      setComment(questionDetail.answerComment ?? '');
    }
  }, [questionDetail, questionId]);

  const questions =
    categoryList?.category.id === categoryId ? loadedQuestions : EMPTY_QUESTIONS;

  const orderIndex = useMemo(
    () => questions.findIndex(q => q.id === questionId),
    [questions, questionId],
  );
  const total = questions.length;
  const index = orderIndex >= 0 ? orderIndex + 1 : 1;
  const isFirst = orderIndex <= 0;
  const isLast = orderIndex < 0 || orderIndex >= total - 1;
  const prevId = orderIndex > 0 ? questions[orderIndex - 1].id : null;
  const nextId =
    orderIndex >= 0 && orderIndex < total - 1 ? questions[orderIndex + 1].id : null;
  const categoryName =
    categoryList?.category.id === categoryId ? categoryList.category.name : '';

  const categoryReady =
    categoryList?.category.id === categoryId && orderIndex >= 0 && total > 0;

  const categoryAlreadyComplete = total > 0 && questions.every(q => q.answered);

  type NextStep =
    | { kind: 'question'; id: string }
    | { kind: 'finish' }
    | { kind: 'needsAnswer' };

  const resolveNextStep = useCallback(
    (currentAnswered: boolean): NextStep | null => {
      const curIdx = questions.findIndex(q => q.id === questionId);
      if (curIdx < 0) {
        return null;
      }

      if (categoryAlreadyComplete) {
        const next = questions[curIdx + 1];
        if (next) {
          return { kind: 'question', id: next.id };
        }
        return currentAnswered ? { kind: 'finish' } : { kind: 'needsAnswer' };
      }

      const answeredIds = new Set(questions.filter(q => q.answered).map(q => q.id));
      if (currentAnswered) {
        answeredIds.add(questionId);
      }
      const after = questions.slice(curIdx + 1).find(q => !answeredIds.has(q.id));
      const before = questions.slice(0, curIdx).find(q => !answeredIds.has(q.id));
      const target = after ?? before;
      if (target) {
        return { kind: 'question', id: target.id };
      }

      return currentAnswered ? { kind: 'finish' } : { kind: 'needsAnswer' };
    },
    [questions, questionId, categoryAlreadyComplete],
  );

  const currentValueFilled =
    detailReady && !!questionDetail
      ? hasAnswerValue(questionDetail.questionType, answerValue) &&
        (questionDetail.commentMode !== 'required' || comment.trim().length > 0) &&
        (questionDetail.evidenceMode !== 'required' || evidenceUrls.length > 0)
      : false;

  const willBeAnswered =
    detailReady &&
    !!questionDetail &&
    ((currentValueFilled && !questionDetail.locked) || questionDetail.answered);

  const primaryLabel = useMemo(() => {
    if (!categoryReady) {
      return 'Next';
    }
    return resolveNextStep(willBeAnswered)?.kind === 'finish' ? 'Finish' : 'Next';
  }, [categoryReady, willBeAnswered, resolveNextStep]);

  const categoriesRemaining = useMemo(
    () => categories.filter(c => c.answered < c.totalQuestions).length,
    [categories],
  );

  const handleEvidence = useCallback((urls: string[], uploading: boolean) => {
    setEvidenceUrls(urls);
    setEvidenceUploading(uploading);
  }, []);

  const uploadEvidence = useCallback(
    (file: EvidenceMedia, onProgress: (fraction: number) => void) =>
      uploadEvidenceFile({ uri: file.uri, name: file.name, mime: file.mime }, onProgress),
    [],
  );

  const persist = useCallback(async (): Promise<boolean> => {
    if (questionDetail?.locked) {
      showToast('This assessment is locked and can no longer be edited.', { type: 'error' });
      return false;
    }
    if (!questionDetail || !currentValueFilled) {
      showToast(missingAnswerReason(questionDetail, answerValue, comment, evidenceUrls), {
        type: 'error',
      });
      return false;
    }
    if (evidenceUploading) {
      showToast('Please wait for evidence to finish uploading.', { type: 'error' });
      return false;
    }
    const body = buildAnswerPayload(
      questionDetail.questionType,
      answerValue,
      comment,
      evidenceUrls,
      detailReady && questionDetail
        ? {
            comment: questionDetail.answerComment,
            evidenceUrls: questionDetail.answerEvidenceUrls,
          }
        : null,
    );
    const result = await saveAnswer({ programId, fieldId, questionId, input: body });
    if (result.conflict) {
      setConflictNonce(n => n + 1);
      loadCategoryQuestions({ programId, fieldId, categoryId });
      loadQuestionDetail({ programId, fieldId, categoryId, questionId });
    }
    if (result.closed) {
      showToast(
        "This program's assessment is not open yet. It opens once the program office locks the survey.",
        { type: 'error' },
      );
      loadSummary({ programId, fieldId });
    } else if (!result.ok && !result.conflict) {
      showToast(result.message ?? 'Could not save this answer. Please try again.', {
        type: 'error',
      });
    }
    return result.ok;
  }, [
    saveAnswer,
    detailReady,
    questionDetail,
    answerValue,
    currentValueFilled,
    comment,
    evidenceUrls,
    evidenceUploading,
    programId,
    fieldId,
    categoryId,
    questionId,
    loadCategoryQuestions,
    loadQuestionDetail,
    loadSummary,
  ]);

  const handleSaveDraft = useCallback(async () => {
    setSavingAction('draft');
    const ok = await persist();
    setSavingAction(null);
    if (ok) {
      showSuccess('Answer saved');
    }
  }, [persist]);

  const handleNext = useCallback(async () => {
    let savedNow = false;
    if (currentValueFilled && !questionDetail?.locked) {
      if (evidenceUploading) {
        showToast('Please wait for evidence to finish uploading.', { type: 'error' });
        return;
      }
      setSavingAction('next');
      const ok = await persist();
      if (!ok) {
        setSavingAction(null);
        return;
      }
      savedNow = true;
    }

    const currentAnswered =
      savedNow || (detailReady && !!questionDetail?.answered);
    const step = resolveNextStep(currentAnswered);
    setSavingAction(null);

    if (step?.kind === 'question') {
      if (savedNow) {
        showSuccess('Answer saved');
      }
      navigation.setParams({ questionId: step.id });
      return;
    }

    if (step?.kind === 'needsAnswer') {
      showToast(missingAnswerReason(questionDetail, answerValue, comment, evidenceUrls), {
        type: 'error',
      });
      return;
    }

    if (!step || !categoryReady) {
      navigation.goBack();
      return;
    }

    setCompletionVisible(true);
  }, [
    currentValueFilled,
    questionDetail,
    answerValue,
    comment,
    evidenceUrls,
    detailReady,
    evidenceUploading,
    persist,
    resolveNextStep,
    categoryReady,
    navigation,
  ]);

  const handleCompletionOk = useCallback(() => {
    setCompletionVisible(false);
    goToFieldSummary(navigation, {
      programId,
      fieldId,
      fieldName: summary?.field.name,
    });
  }, [goToFieldSummary, navigation, fieldId, programId, summary]);

  const handlePrevious = useCallback(() => {
    if (prevId) {
      navigation.setParams({ questionId: prevId });
    }
  }, [prevId, navigation]);

  const handleNextQuestion = useCallback(() => {
    if (nextId) {
      navigation.setParams({ questionId: nextId });
    }
  }, [nextId, navigation]);

  if (gated) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Question" onBack={() => navigation.goBack()} />
        <View style={styles.stateCenter}>
          <View style={gateStyles.badge}>
            <AppIcon name={ICONS.LOCK} size={moderateScale(30)} color={COLORS.accent} />
          </View>
          <AppText style={styles.stateTitle}>
            {access.state === 'program_not_open'
              ? "This assessment opens once the program office locks the survey — you'll be notified."
              : `You can answer this once you are on ${summary?.field.name ?? 'the field'} and the visit is marked as arrived.`}
          </AppText>
          <Button
            title="What do I need to do?"
            onPress={() => setLockedOpen(true)}
            fullWidth={false}
            style={styles.retryBtn}
          />
        </View>

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
  }

  if (loadingQuestion && !detailReady) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Question" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <View style={skStyles.headerGap}>
            <View style={skStyles.rowBetween}>
              <AppShimmerChip width={scale(120)} />
              <AppShimmerText width={scale(40)} height={moderateScale(12)} />
            </View>
            <AppShimmerText
              count={2}
              width="95%"
              lastLineWidth="70%"
              height={moderateScale(16)}
            />
            <AppShimmerText count={2} width="100%" lastLineWidth="55%" />
          </View>

          <View style={styles.section}>
            <AppShimmerText width={scale(90)} height={moderateScale(12)} />
            <View style={skStyles.scoreGrid}>
              {[0, 1, 2, 3].map(i => (
                <AppShimmer
                  key={i}
                  width="47%"
                  height={scale(92)}
                  radius={borderRadius.lg}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <AppShimmerText width={scale(140)} height={moderateScale(12)} />
            <AppShimmerInput withLabel={false} height={scale(100)} />
          </View>
        </View>
      </View>
    );
  }

  if (!detailReady || !questionDetail) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Question" onBack={() => navigation.goBack()} />
        <View style={styles.stateCenter}>
          <AppIcon name={ICONS.QUESTION} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>
            {error ?? 'This question could not be loaded.'}
          </AppText>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            fullWidth={false}
            style={styles.retryBtn}
          />
        </View>
      </View>
    );
  }

  const locked = questionDetail.locked;
  const hasComment = comment.trim().length > 0;

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Question" onBack={() => navigation.goBack()} />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}>
        <QuestionHeader
          categoryName={categoryName}
          index={index}
          total={total}
          code={questionDetail.code}
          title={questionDetail.text}
          description={questionDetail.guidance}
        />

        {locked ? (
          <View style={styles.lockedBanner}>
            <AppIcon name={ICONS.LOCK_CHECK} size={moderateScale(18)} color={COLORS.primary} />
            <AppText style={styles.lockedBannerText}>
              This assessment has been submitted. You can view the answers but
              can no longer edit them.
            </AppText>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title={ANSWER_SECTION_TITLE[questionDetail.questionType]?.[locked ? 'view' : 'edit'] ??
              (locked ? 'Answer' : 'Select Score')}
          />
          <AnswerInput
            questionType={questionDetail.questionType}
            value={answerValue}
            onChange={setAnswerValue}
            options={questionDetail.options}
            scoreDescriptions={questionDetail.scoreDescriptions}
            readOnly={locked}
          />
        </View>

        {questionDetail.commentMode !== 'off' ? (
          <View style={styles.section}>
            <SectionHeader
              title={
                locked
                  ? 'Comments'
                  : questionDetail.commentMode === 'required'
                    ? 'Description (required)'
                    : 'Description (optional)'
              }
            />
            {locked ? (
              <View style={styles.readonlyBox}>
                <AppText
                  style={styles.readonlyText}
                  color={hasComment ? COLORS.gray900 : COLORS.gray500}>
                  {hasComment ? comment.trim() : 'No comment was added.'}
                </AppText>
              </View>
            ) : (
              <View style={styles.commentBox}>
                <AppTextInput
                  style={styles.commentInput}
                  placeholder="Describe the evidence or add context…"
                  placeholderTextColor={COLORS.gray500}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  maxLength={COMMENT_MAX}
                  textAlignVertical="top"
                />
                <AppText style={styles.charCount} color={COLORS.gray500}>
                  {comment.length}/{COMMENT_MAX}
                </AppText>
              </View>
            )}
          </View>
        ) : null}

        {questionDetail.evidenceMode !== 'off' ? (
          <View style={styles.section}>
            <SectionHeader
              title={
                locked
                  ? 'Evidence'
                  : questionDetail.evidenceMode === 'required'
                    ? 'Evidence (required)'
                    : 'Evidence (optional)'
              }
            />
            <EvidenceUploader
              key={`${questionId}-${conflictNonce}`}
              initialUrls={questionDetail.answerEvidenceUrls}
              onChange={handleEvidence}
              upload={uploadEvidence}
              disabled={locked}
              maxSelection={5}
              maxSizeMB={50}
            />
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      <View style={{ paddingBottom: insets.bottom + scale(8) }}>
        <QuestionFooter
          isFirst={isFirst}
          isLast={isLast}
          readOnly={locked}
          primaryLabel={primaryLabel}
          savingDraft={saving && savingAction === 'draft'}
          submitting={saving && savingAction === 'next'}
          onPrevious={handlePrevious}
          onSaveDraft={handleSaveDraft}
          onNext={handleNext}
          onNextQuestion={handleNextQuestion}
        />
      </View>

      <CategoryCompleteModal
        visible={completionVisible}
        categoryName={categoryName}
        answered={summary?.assessment.answered ?? 0}
        total={summary?.assessment.totalQuestions ?? 0}
        categoriesRemaining={categoriesRemaining}
        onOk={handleCompletionOk}
      />
    </View>
  );
};

export default QuestionView;

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
  headerGap: { gap: spacing[2] },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
});
