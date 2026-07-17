import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { uploadEvidenceFile } from '../../api/assessmentApi';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchCategoryQuestionsThunk,
  fetchQuestionDetailThunk,
  saveAssessmentAnswerThunk,
  selectAssessmentCategories,
  selectAssessmentError,
  selectAssessmentSaving,
  selectCategoryQuestionList,
  selectQuestionDetail,
  selectQuestionList,
  selectQuestionLoading,
} from '../../redux/slices/assessmentSlice';
import { setResumePoint } from '../../redux/slices/assessmentProgressSlice';
import { showSuccess, showToast } from '../../services/toastService';
import type { QuestionScore } from '../../types/assessment';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import { styles } from './AssessmentQuestionDetailScreenStyle';

const COMMENT_MAX = 500;

type SavingAction = 'draft' | 'next' | null;

const AssessmentQuestionDetailScreen: React.FC<
  AppScreenProps<'AssessmentQuestionDetail'>
> = ({ route, navigation }) => {
  const { fieldId, categoryId, questionId } = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const questionDetail = useAppSelector(selectQuestionDetail);
  const categoryList = useAppSelector(selectCategoryQuestionList);
  const questions = useAppSelector(selectQuestionList);
  const loadingQuestion = useAppSelector(selectQuestionLoading);
  const saving = useAppSelector(selectAssessmentSaving);
  const error = useAppSelector(selectAssessmentError);
  const categories = useAppSelector(selectAssessmentCategories);

  const [score, setScore] = useState<QuestionScore | null>(null);
  const [comment, setComment] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [savingAction, setSavingAction] = useState<SavingAction>(null);

  useEffect(() => {
    dispatch(fetchQuestionDetailThunk({ fieldId, categoryId, questionId }));
  }, [dispatch, fieldId, categoryId, questionId]);

  useEffect(() => {
    dispatch(setResumePoint({ fieldId, categoryId, questionId }));
  }, [dispatch, fieldId, categoryId, questionId]);

  useEffect(() => {
    if (!categoryList || categoryList.category.id !== categoryId) {
      dispatch(fetchCategoryQuestionsThunk({ fieldId, categoryId }));
    }
  }, [dispatch, fieldId, categoryId, categoryList]);

  const detailReady = !!questionDetail && questionDetail.id === questionId;

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
  const categoryName = categoryList?.category.name ?? '';

  const nextCategory = useMemo(() => {
    const idx = categories.findIndex(c => c.id === categoryId);
    return (
      categories.slice(idx + 1).find(c => c.answered < c.totalQuestions) ??
      categories.find(c => c.id !== categoryId && c.answered < c.totalQuestions) ??
      null
    );
  }, [categories, categoryId]);

  const primaryLabel = !isLast
    ? 'Next'
    : nextCategory
      ? `Next: ${nextCategory.name}`
      : 'Review';

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
    const body = { score, comment: comment.trim(), evidenceUrls };
    if (__DEV__) {
      console.log('[assessment] saveAnswer body →', JSON.stringify(body, null, 2));
    }
    const action = await dispatch(
      saveAssessmentAnswerThunk({
        fieldId,
        questionId,
        input: body,
      }),
    );
    return saveAssessmentAnswerThunk.fulfilled.match(action);
  }, [
    dispatch,
    questionDetail,
    score,
    comment,
    evidenceUrls,
    evidenceUploading,
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
    if (score !== null && !questionDetail?.locked) {
      if (evidenceUploading) {
        showToast('Please wait for evidence to finish uploading.', { type: 'error' });
        return;
      }
      setSavingAction('next');
      const ok = await persist();
      setSavingAction(null);
      if (!ok) {
        return;
      }
      showSuccess('Answer saved');
    }

    if (!isLast && nextId) {
      navigation.setParams({ questionId: nextId });
      return;
    }
    if (nextCategory) {
      navigation.replace('AssessmentCategory', {
        fieldId,
        categoryId: nextCategory.id,
        categoryName: nextCategory.name,
      });
      return;
    }
    navigation.navigate('AssessmentReview', { fieldId });
  }, [
    score,
    questionDetail,
    evidenceUploading,
    persist,
    isLast,
    nextId,
    navigation,
    nextCategory,
    fieldId,
  ]);

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
