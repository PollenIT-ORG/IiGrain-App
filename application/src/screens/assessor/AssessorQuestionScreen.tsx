import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, AppTextInput, Button } from '../../components';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import SectionHeader from '../../components/assessment/SectionHeader';
import QuestionHeader from '../../components/assessment/QuestionHeader';
import ScoreSelector from '../../components/assessment/ScoreSelector';
import QuestionFooter from '../../components/assessment/QuestionFooter';
import EvidenceUploader, {
  type EvidenceMedia,
} from '../../components/assessment/EvidenceUploader';
import {
  AppShimmer,
  AppShimmerInput,
  AppShimmerText,
} from '../../components/Shimmer';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchAssessorCategoryQuestionsThunk,
  fetchAssessorQuestionDetailThunk,
  saveAssessorAnswerThunk,
  selectAssessorCategories,
  selectAssessorCategoryQuestionList,
  selectAssessorError,
  selectAssessorQuestionDetail,
  selectAssessorQuestionList,
  selectAssessorQuestionLoading,
  selectAssessorSaving,
} from '../../redux/slices/assessorSlice';
import { uploadEvidenceFile } from '../../api/assessmentApi';
import { showSuccess, showToast } from '../../services/toastService';
import type { QuestionScore } from '../../types/assessment';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const COMMENT_MAX = 500;
type SavingAction = 'draft' | 'next' | null;

const AssessorQuestionScreen: React.FC<AssessorScreenProps<'AssessorQuestion'>> = ({
  route,
  navigation,
}) => {
  const { fieldId, categoryId, questionId } = route.params;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const questionDetail = useAppSelector(selectAssessorQuestionDetail);
  const categoryList = useAppSelector(selectAssessorCategoryQuestionList);
  const questions = useAppSelector(selectAssessorQuestionList);
  const loadingQuestion = useAppSelector(selectAssessorQuestionLoading);
  const saving = useAppSelector(selectAssessorSaving);
  const error = useAppSelector(selectAssessorError);
  const categories = useAppSelector(selectAssessorCategories);

  const [score, setScore] = useState<QuestionScore | null>(null);
  const [comment, setComment] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [savingAction, setSavingAction] = useState<SavingAction>(null);

  useEffect(() => {
    dispatch(fetchAssessorQuestionDetailThunk({ fieldId, categoryId, questionId }));
  }, [dispatch, fieldId, categoryId, questionId]);

  useEffect(() => {
    if (!categoryList || categoryList.category.id !== categoryId) {
      dispatch(fetchAssessorCategoryQuestionsThunk({ fieldId, categoryId }));
    }
  }, [dispatch, fieldId, categoryId, categoryList]);

  const detailReady = !!questionDetail && questionDetail.id === questionId;

  useEffect(() => {
    if (questionDetail && questionDetail.id === questionId) {
      setScore(questionDetail.answerScore);
      setComment(questionDetail.answerComment ?? '');
    }
  }, [questionDetail, questionId]);

  const orderIndex = useMemo(() => questions.findIndex(q => q.id === questionId), [questions, questionId]);
  const total = questions.length;
  const index = orderIndex >= 0 ? orderIndex + 1 : 1;
  const isFirst = orderIndex <= 0;
  const isLast = orderIndex < 0 || orderIndex >= total - 1;
  const prevId = orderIndex > 0 ? questions[orderIndex - 1].id : null;
  const nextId = orderIndex >= 0 && orderIndex < total - 1 ? questions[orderIndex + 1].id : null;
  const categoryName = categoryList?.category.name ?? '';
  const locked = !!questionDetail?.locked;

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
    if (locked) {
      showToast('This assessment is submitted and can no longer be edited.', { type: 'error' });
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
    const action = await dispatch(
      saveAssessorAnswerThunk({ fieldId, questionId, input: { score, comment: comment.trim(), evidenceUrls } }),
    );
    return saveAssessorAnswerThunk.fulfilled.match(action);
  }, [locked, score, evidenceUrls, evidenceUploading, dispatch, fieldId, questionId, comment]);

  const handleSaveDraft = useCallback(async () => {
    setSavingAction('draft');
    const ok = await persist();
    setSavingAction(null);
    if (ok) {
      showSuccess('Answer saved');
    }
  }, [persist]);

  const handleNext = useCallback(async () => {
    if (score !== null && !locked) {
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
      navigation.replace('AssessorCategory', {
        fieldId,
        categoryId: nextCategory.id,
        categoryName: nextCategory.name,
      });
      return;
    }
    navigation.navigate('AssessorReview', { fieldId });
  }, [
    score,
    locked,
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
          <AppShimmer width="40%" height={moderateScale(12)} radius={borderRadius.sm} />
          <AppShimmerText count={2} width="90%" lastLineWidth="70%" style={styles.loadingGap} />

          <View style={styles.section}>
            <AppShimmer width="35%" height={moderateScale(14)} radius={borderRadius.sm} />
            <View style={styles.loadingGrid}>
              <AppShimmer width="48%" height={scale(64)} radius={borderRadius.lg} />
              <AppShimmer width="48%" height={scale(64)} radius={borderRadius.lg} />
              <AppShimmer width="48%" height={scale(64)} radius={borderRadius.lg} />
              <AppShimmer width="48%" height={scale(64)} radius={borderRadius.lg} />
            </View>
          </View>

          <View style={styles.section}>
            <AppShimmer width="45%" height={moderateScale(14)} radius={borderRadius.sm} style={styles.loadingGap} />
            <AppShimmerInput withLabel={false} height={scale(96)} />
          </View>
        </View>
      </View>
    );
  }

  if (!detailReady || !questionDetail) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Question" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <AppIcon name={ICONS.QUESTION} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>{error ?? 'This question could not be loaded.'}</AppText>
          <Button title="Go Back" onPress={() => navigation.goBack()} fullWidth={false} style={styles.retryBtn} />
        </View>
      </View>
    );
  }

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
          <View style={styles.lockBanner}>
            <AppIcon name={ICONS.LOCK_CHECK} size={moderateScale(16)} color={COLORS.primary} />
            <AppText style={styles.lockText}>Submitted - read-only.</AppText>
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
          <SectionHeader title="Evidence / Comments" />
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
              editable={!locked}
            />
            <AppText style={styles.charCount} color={COLORS.gray500}>{comment.length}/{COMMENT_MAX}</AppText>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Upload Evidence" />
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

export default AssessorQuestionScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  body: { padding: spacing[4], paddingBottom: spacing[8] },
  section: { marginTop: spacing[5] },
  loadingGap: { marginTop: spacing[2] },
  loadingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing[3],
    marginTop: spacing[3],
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    marginTop: spacing[3],
  },
  lockText: { ...presets.bodySM, color: COLORS.primaryDark },
  commentBox: {
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    padding: spacing[3],
  },
  commentInput: { ...presets.inputText, minHeight: scale(96), color: COLORS.gray900 },
  charCount: { ...presets.caption, alignSelf: 'flex-end', marginTop: spacing[1] },
  stateTitle: { ...presets.headingXS, color: COLORS.gray900, marginTop: spacing[3], textAlign: 'center' },
  retryBtn: { marginTop: spacing[4], minWidth: moderateScale(160) },
});
