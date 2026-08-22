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
import ScoreSelector from '../../../components/assessment/ScoreSelector';
import QuestionFooter from '../../../components/assessment/QuestionFooter';
import EvidenceUploader, {
  type EvidenceMedia,
} from '../../../components/assessment/EvidenceUploader';
import AssessmentLockedModal from '../../../components/assessment/AssessmentLockedModal';
import CategoryCompleteModal from '../../../components/assessment/CategoryCompleteModal';
import { uploadEvidenceFile } from '../../../api/assessmentApi';
import { showSuccess, showToast } from '../../../services/toastService';
import type {
  AssessmentQuestionListItem,
  QuestionScore,
} from '../../../types/assessment';
import { buildAnswerPayload } from '../../../utils/answerPayload';
import { styles } from '../AssessmentQuestionDetailScreenStyle';
import { useAssessmentFlow } from './useAssessmentFlow';
import type { AssessmentRole, FlowNavigation } from './flowTypes';

const COMMENT_MAX = 500;

const EMPTY_QUESTIONS: AssessmentQuestionListItem[] = [];

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

  const [score, setScore] = useState<QuestionScore | null>(null);
  const [comment, setComment] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [savingAction, setSavingAction] = useState<SavingAction>(null);
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
    setScore(null);
    setComment('');
    setEvidenceUrls([]);
  }, [questionId]);

  useEffect(() => {
    if (questionDetail && questionDetail.id === questionId) {
      setScore(questionDetail.answerScore);
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
    | { kind: 'needsScore' };

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
        return currentAnswered ? { kind: 'finish' } : { kind: 'needsScore' };
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

      return currentAnswered ? { kind: 'finish' } : { kind: 'needsScore' };
    },
    [questions, questionId, categoryAlreadyComplete],
  );

  const willBeAnswered =
    detailReady &&
    !!questionDetail &&
    ((score !== null && !questionDetail.locked) || questionDetail.answered);

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
    if (score === null) {
      showToast('Please select a score to continue', { type: 'error' });
      return false;
    }
    if (evidenceUploading) {
      showToast('Please wait for evidence to finish uploading.', { type: 'error' });
      return false;
    }
    const body = buildAnswerPayload(
      score,
      comment,
      evidenceUrls,
      detailReady && questionDetail
        ? {
            comment: questionDetail.answerComment,
            evidenceUrls: questionDetail.answerEvidenceUrls,
          }
        : null,
    );
    if (__DEV__) {
      console.log('[assessment] saveAnswer body →', JSON.stringify(body, null, 2));
    }
    return saveAnswer({ programId, fieldId, questionId, input: body });
  }, [
    saveAnswer,
    detailReady,
    questionDetail,
    score,
    comment,
    evidenceUrls,
    evidenceUploading,
    programId,
    fieldId,
    questionId,
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
    if (score !== null && !questionDetail?.locked) {
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

    if (step?.kind === 'needsScore') {
      showToast('Please select a score to continue', { type: 'error' });
      return;
    }

    if (!step || !categoryReady) {
      navigation.goBack();
      return;
    }

    setCompletionVisible(true);
  }, [
    score,
    questionDetail,
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
            You can answer this once you are on{' '}
            {summary?.field.name ?? 'the field'} and the visit is marked as arrived.
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
          <SectionHeader title={locked ? 'Score' : 'Select Score'} />
          <ScoreSelector
            value={score}
            onChange={setScore}
            readOnly={locked}
            descriptions={questionDetail.scoreDescriptions}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title={locked ? 'Comments' : 'Evidence / Comments'} />
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

        <View style={styles.section}>
          <SectionHeader title={locked ? 'Evidence' : 'Upload Evidence'} />
          <EvidenceUploader
            key={questionId}
            initialUrls={questionDetail.answerEvidenceUrls}
            onChange={handleEvidence}
            upload={uploadEvidence}
            disabled={locked}
            maxSelection={5}
            maxSizeMB={50}
          />
        </View>
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
