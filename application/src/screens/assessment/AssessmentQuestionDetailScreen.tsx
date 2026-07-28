import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, AppTextInput, Button } from '../../components';
import {
  AppShimmer,
  AppShimmerChip,
  AppShimmerInput,
  AppShimmerText,
} from '../../components/Shimmer';
import { COLORS, borderRadius, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import SectionHeader from '../../components/assessment/SectionHeader';
import QuestionHeader from '../../components/assessment/QuestionHeader';
import ScoreSelector from '../../components/assessment/ScoreSelector';
import QuestionFooter from '../../components/assessment/QuestionFooter';
import EvidenceUploader, {
  type EvidenceMedia,
} from '../../components/assessment/EvidenceUploader';
import CategoryCompleteModal from '../../components/assessment/CategoryCompleteModal';
import { uploadEvidenceFile } from '../../api/assessmentApi';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchAssessmentSummaryThunk,
  fetchCategoryQuestionsThunk,
  fetchQuestionDetailThunk,
  saveAssessmentAnswerThunk,
  selectAssessmentCategories,
  selectAssessmentError,
  selectAssessmentSaving,
  selectAssessmentSummary,
  selectCategoryQuestionList,
  selectLoadedSummaryScope,
  selectQuestionDetail,
  selectQuestionList,
  selectQuestionLoading,
} from '../../redux/slices/assessmentSlice';
import { setResumePoint } from '../../redux/slices/assessmentProgressSlice';
import { showSuccess, showToast } from '../../services/toastService';
import type { QuestionScore } from '../../types/assessment';
import { buildAnswerPayload } from '../../utils/answerPayload';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import { resetToFieldSummary } from './assessmentNavigation';
import { styles } from './AssessmentQuestionDetailScreenStyle';

const COMMENT_MAX = 500;

type SavingAction = 'draft' | 'next' | null;

const AssessmentQuestionDetailScreen: React.FC<
  AppScreenProps<'AssessmentQuestionDetail'>
> = ({ route, navigation }) => {
  const { programId, fieldId, categoryId, questionId } = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const questionDetail = useAppSelector(selectQuestionDetail);
  const categoryList = useAppSelector(selectCategoryQuestionList);
  const questions = useAppSelector(selectQuestionList);
  const loadingQuestion = useAppSelector(selectQuestionLoading);
  const saving = useAppSelector(selectAssessmentSaving);
  const error = useAppSelector(selectAssessmentError);
  const categories = useAppSelector(selectAssessmentCategories);
  const summary = useAppSelector(selectAssessmentSummary);
  const loadedSummaryScope = useAppSelector(selectLoadedSummaryScope);

  const [score, setScore] = useState<QuestionScore | null>(null);
  const [comment, setComment] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [savingAction, setSavingAction] = useState<SavingAction>(null);
  const [completionVisible, setCompletionVisible] = useState(false);

  useEffect(() => {
    dispatch(fetchQuestionDetailThunk({ programId, fieldId, categoryId, questionId }));
  }, [dispatch, programId, fieldId, categoryId, questionId]);

  useEffect(() => {
    dispatch(setResumePoint({ programId, fieldId, categoryId, questionId }));
  }, [dispatch, programId, fieldId, categoryId, questionId]);

  // `categoryQuestions` is a single shared Redux slot, and this screen stays
  // mounted (unfocused) while the user browses another category. These fetches
  // are therefore focus-gated: an unfocused screen must never pull the slot back
  // to its own category, or the two screens refetch each other forever.
  useFocusEffect(
    useCallback(() => {
      if (!categoryList || categoryList.category.id !== categoryId) {
        dispatch(fetchCategoryQuestionsThunk({ programId, fieldId, categoryId }));
      }
    }, [dispatch, programId, fieldId, categoryId, categoryList]),
  );

  // Ensure the summary (per-category answered counts) is for THIS field, so the
  // "next unanswered category" + Review-vs-Next decision is accurate.
  useFocusEffect(
    useCallback(() => {
      if (loadedSummaryScope !== `${programId}:${fieldId}`) {
        dispatch(fetchAssessmentSummaryThunk({ programId, fieldId }));
      }
    }, [dispatch, programId, fieldId, loadedSummaryScope]),
  );

  const detailReady = !!questionDetail && questionDetail.id === questionId;

  // Moving between questions reuses this screen (setParams, no remount), so the
  // previous question's answer has to be cleared the instant the id changes.
  // Otherwise it lingers until the next detail lands and briefly reads as "this
  // question is answered" — which is enough to show Finish on an unscored one.
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
  // The shared slot may briefly hold another category while a fetch is in
  // flight, so only trust the name when it is actually this category's.
  const categoryName =
    categoryList?.category.id === categoryId ? categoryList.category.name : '';

  // The question list must be loaded AND be this category's before we can claim
  // the category is finished — otherwise a still-loading list would read as
  // "nothing left" and wrongly show the completion modal.
  const categoryReady =
    categoryList?.category.id === categoryId && orderIndex >= 0 && total > 0;

  // Was every question here ALREADY answered before the user touched this one?
  // This decides which of the two "what's next" rules applies, and it must be
  // read from the pre-save list — never from the state after the current save.
  const categoryAlreadyComplete = total > 0 && questions.every(q => q.answered);

  type NextStep =
    | { kind: 'question'; id: string }
    | { kind: 'finish' }
    /** This question is the only thing left, and it still has no score. */
    | { kind: 'needsScore' };

  /**
   * Where the primary button goes. `currentAnswered` = will the current question
   * count as answered after this action (just saved, or already saved).
   *
   * Two rules, deliberately kept apart:
   *  - Revisiting a category that was already complete → plain positional
   *    paging, so "Finish" appears ONLY on the genuinely last question.
   *  - Still working through a category → jump to whatever is unanswered, and
   *    "Finish" ONLY when this answer genuinely closes the category out.
   */
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
        // Even here the current answer decides it. The list's `answered` flags
        // can be stale (a discard clears answers without reloading them), and a
        // stale flag must never produce "Finish" over an unscored question.
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

      // Nothing else is open — but the category is only actually finished if
      // THIS question counts as answered. Without a score it does not, so we
      // must not offer "Finish" or pop the completion modal.
      return currentAnswered ? { kind: 'finish' } : { kind: 'needsScore' };
    },
    [questions, questionId, categoryAlreadyComplete],
  );

  /**
   * Will the current question count as answered once this action completes?
   * Gated on the detail actually belonging to THIS question — during a question
   * switch the slot can still hold the previous one, and trusting it there is
   * what made Finish appear on a question the user had not scored.
   */
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

  // Reported on the completion modal so the user knows how much of the field is
  // still open before choosing where to go next.
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
    // Only send what actually changed: an absent key keeps the stored value, so
    // a score-only save must not echo the comment/photos back (that would revert
    // anything saved elsewhere since this screen loaded).
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
    const action = await dispatch(
      saveAssessmentAnswerThunk({
        programId,
        fieldId,
        questionId,
        input: body,
      }),
    );
    return saveAssessmentAnswerThunk.fulfilled.match(action);
  }, [
    dispatch,
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

    // Same gate as the label: only a detail belonging to THIS question may say
    // it is already answered, so the two can never disagree.
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

    // The last open question in the category, still unscored — there is nowhere
    // to go and the category is not complete, so ask for the score instead.
    if (step?.kind === 'needsScore') {
      showToast('Please select a score to continue', { type: 'error' });
      return;
    }

    // List not loaded yet — we cannot claim the category is finished, so just
    // step back to the category rather than showing a wrong "complete" message.
    if (!step || !categoryReady) {
      navigation.goBack();
      return;
    }

    // Category done — report field progress and let the user choose what is
    // next. No success toast here: it would render behind this native Modal.
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

  // "OK" hands the user back to the field's category list rather than pushing
  // them into whatever category happens to come next — and resets the stack so
  // repeated category → question rounds cannot pile up behind them.
  const handleCompletionOk = useCallback(() => {
    setCompletionVisible(false);
    resetToFieldSummary(navigation, {
      programId,
      fieldId,
      fieldName: summary?.field.name,
    });
  }, [navigation, fieldId, programId, summary]);


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

export default AssessmentQuestionDetailScreen;

const skStyles = StyleSheet.create({
  headerGap: { gap: spacing[2] },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
});
