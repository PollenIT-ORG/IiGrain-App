import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import { AppShimmer, AppShimmerText } from '../../components/Shimmer';
import AssessmentProgressBar from '../../components/assessment/AssessmentProgressBar';
import AssessmentSubmitSuccess from '../../components/assessment/AssessmentSubmitSuccess';
import FieldRegenIndexCard from '../../components/assessment/FieldRegenIndexCard';
import { COLORS, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
import {
  clearSubmitResult,
  fetchAssessmentReviewThunk,
  fetchAssessmentSummaryThunk,
  fetchFieldRegenIndexThunk,
  selectAnswerVersion,
  selectAssessmentError,
  selectAssessmentReview,
  selectAssessmentSubmitResult,
  selectAssessmentSubmitting,
  selectFieldRegenIndex,
  selectRegenIndexLoading,
  selectLoadedReviewScope,
  selectLoadedRegenScope,
  selectReviewLoading,
  submitAssessmentThunk,
} from '../../redux/slices/assessmentSlice';
import { showToast } from '../../services/toastService';
import type {
  AssessmentReviewQuestion,
  QuestionScore,
} from '../../types/assessment';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import { resetToAssessmentTab } from './assessmentNavigation';
import { styles } from './AssessmentReviewScreenStyle';

const pct = (value: number): string => `${Math.round(value)}%`;

const SCORE_META: Record<QuestionScore, { label: string; color: string }> = {
  0: { label: 'Basic', color: COLORS.danger },
  1: { label: 'Beginning', color: '#EF9A2E' },
  2: { label: 'Developing', color: '#2F6FED' },
  3: { label: 'Advanced', color: '#2E9E5B' },
};

const QuestionCard: React.FC<{
  question: AssessmentReviewQuestion;
  onPress?: () => void;
}> = ({ question, onPress }) => {
  const meta =
    question.answered && question.score !== null ? SCORE_META[question.score] : null;

  const content = (
    <>
      <AppText style={styles.qText} numberOfLines={2}>
        {question.code ? `${question.code}. ` : ''}
        {question.text}
      </AppText>

      <View style={styles.qScoreBox}>
        <AppText style={[styles.qScore, { color: meta ? meta.color : COLORS.gray500 }]}>
          {meta ? question.score : '—'}
        </AppText>
        <AppText style={styles.qScoreLabel}>{meta ? meta.label : 'Pending'}</AppText>
      </View>

      {onPress ? (
        <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(20)} color={COLORS.gray500} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View question ${question.code}`}
        style={({ pressed }) => [styles.qCard, pressed && styles.qCardPressed]}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.qCard}>{content}</View>;
};

const AssessmentReviewScreen: React.FC<AppScreenProps<'AssessmentReview'>> = ({
  route,
  navigation,
}) => {
  const { programId, fieldId, locked: forcedLock } = route.params;
  const scope = `${programId}:${fieldId}`;
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();

  const review = useAppSelector(selectAssessmentReview);
  const loading = useAppSelector(selectReviewLoading);
  const submitting = useAppSelector(selectAssessmentSubmitting);
  const submitResult = useAppSelector(selectAssessmentSubmitResult);
  const error = useAppSelector(selectAssessmentError);

  const regenIndex = useAppSelector(selectFieldRegenIndex);
  const regenIndexLoading = useAppSelector(selectRegenIndexLoading);
  const loadedReviewScope = useAppSelector(selectLoadedReviewScope);
  const loadedRegenScope = useAppSelector(selectLoadedRegenScope);
  const answerVersion = useAppSelector(selectAnswerVersion);

  const ready = !!review && loadedReviewScope === scope;

  useEffect(() => {
    if (!ready) {
      dispatch(fetchAssessmentReviewThunk({ programId, fieldId }));
    }
  }, [dispatch, programId, fieldId, ready]);

  const regenReady = !!regenIndex && loadedRegenScope === scope;
  // FOCUS-GATED on purpose. `regenIndex` is a single shared slot, so this screen
  // and AssessmentFieldSummary (which stays mounted underneath) used to fight
  // over it: each fulfilled fetch flipped the other's `regenReady` to false,
  // which re-dispatched, which flipped this one back — an endless refetch that
  // showed up as the RHI card flickering. Only the focused screen may fetch.
  useSyncedFetch({
    tags: [Tags.regen(fieldId)],
    run: useCallback(
      () => dispatch(fetchFieldRegenIndexThunk({ programId, fieldId })),
      [dispatch, programId, fieldId],
    ),
    hasData: regenReady,
    enabled: !!programId && !!fieldId,
  });

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      dispatch(fetchAssessmentReviewThunk({ programId, fieldId }));
      dispatch(fetchFieldRegenIndexThunk({ programId, fieldId }));
    }, [dispatch, programId, fieldId]),
  );

  // Redux-driven safety net: fires the moment an answer is saved anywhere in the
  // app (not gated on navigation focus events), so data is already fresh by the
  // time the user navigates back here.
  const lastSyncedAnswerVersion = useRef(answerVersion);
  useEffect(() => {
    if (answerVersion === lastSyncedAnswerVersion.current) {
      return;
    }
    lastSyncedAnswerVersion.current = answerVersion;
    dispatch(fetchAssessmentReviewThunk({ programId, fieldId }));
    dispatch(fetchFieldRegenIndexThunk({ programId, fieldId }));
  }, [answerVersion, dispatch, programId, fieldId]);

  const submission = review?.submission;
  const allAnswered =
    !!submission &&
    submission.totalQuestions > 0 &&
    submission.answered >= submission.totalQuestions;
  const isLocked = forcedLock === true || !!submission?.submittedAtISO;
  const headerTitle = forcedLock === true ? 'Assessment Result' : 'Review & Submit';

  const showSuccess = !!submitResult && submitResult.field.id === fieldId;

  const onRetry = useCallback(() => {
    dispatch(fetchAssessmentReviewThunk({ programId, fieldId }));
  }, [dispatch, programId, fieldId]);

  const openQuestion = useCallback(
    (categoryId: string, questionId: string) => {
      navigation.navigate('AssessmentQuestionDetail', {
        programId,
        fieldId,
        categoryId,
        questionId,
      });
    },
    [navigation, programId, fieldId],
  );

  const onSubmit = useCallback(async () => {
    if (!allAnswered) {
      showToast('Answer every question before submitting.', { type: 'error' });
      return;
    }
    await dispatch(submitAssessmentThunk({ programId, fieldId }));
  }, [allAnswered, dispatch, programId, fieldId]);

  const onDone = useCallback(() => {
    dispatch(clearSubmitResult());
    dispatch(fetchAssessmentSummaryThunk({ programId, fieldId }));
    // Submitted — the whole run is done, so go straight to the Assessment tab
    // with a clean stack. It refetches on focus, moving this field out of the
    // pending list and into History.
    resetToAssessmentTab(navigation);
  }, [dispatch, programId, fieldId, navigation]);

  const successScore = useMemo(
    () => (submitResult ? `${submitResult.totalScore} / ${submitResult.maxScore}` : undefined),
    [submitResult],
  );

  if (!ready) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title={headerTitle} onBack={() => navigation.goBack()} />
        {error && !loading ? (
          <View style={styles.center}>
            <AppIcon
              name={ICONS.ERROR}
              size={moderateScale(48)}
              color={COLORS.gray500}
            />
            <AppText style={styles.stateTitle}>Couldn't load review</AppText>
            <AppText style={styles.stateMessage}>{error}</AppText>
            <Button title="Retry" onPress={onRetry} fullWidth={false} style={styles.retryBtn} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}>
            {[0, 1].map(section => (
              <View key={section}>
                <AppShimmerText
                  width={scale(160)}
                  height={moderateScale(14)}
                  style={styles.sectionHeader}
                />
                {[0, 1, 2].map(row => (
                  <View key={row} style={styles.qCard}>
                    <View style={skStyles.flex1}>
                      <AppShimmerText count={2} width="100%" lastLineWidth="60%" />
                    </View>
                    <View style={styles.qScoreBox}>
                      <AppShimmer width={scale(22)} height={moderateScale(22)} />
                      <AppShimmerText
                        width={scale(48)}
                        height={moderateScale(10)}
                        style={skStyles.scoreLabel}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title={headerTitle}
        // rightActions={['filter']}
        rightActions={null}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
       <View style={styles.regenSection}>
          <FieldRegenIndexCard
            data={regenReady ? regenIndex : null}
            loading={regenIndexLoading}
          />
        </View>
        {review.categories.map(category => (
          <View key={category.id}>
            <AppText style={styles.sectionHeader}>Section: {category.name}</AppText>
            {category.questions.map(question => (
              <QuestionCard
                key={question.id}
                question={question}
                onPress={
                  isLocked ? () => openQuestion(category.id, question.id) : undefined
                }
              />
            ))}
          </View>
        ))}


 <AssessmentSubmitSuccess
        visible={showSuccess}
        title="Assessment Submitted"
        message={`${review.field.name} is now locked for review.`}
        scoreLabel={successScore}
        percentLabel={submitResult ? pct(submitResult.percentage) : undefined}
        onDone={onDone}
      />

       
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + moderateScale(12) }]}>
        <View style={styles.footerRow}>
          <AppText style={styles.completedLabel}>Completed</AppText>
          <AppText style={styles.completedCount}>
            {review.submission.answered} / {review.submission.totalQuestions}
          </AppText>
        </View>

        <AssessmentProgressBar progress={Math.round(review.submission.percentage)} />

        {isLocked ? (
          <View style={styles.lockNote}>
            <AppIcon name={ICONS.LOCK_CHECK} size={moderateScale(18)} color={COLORS.primary} />
            <AppText style={styles.lockNoteText}>Submitted &amp; locked</AppText>
          </View>
        ) : (
          <Button
            title="Submit Assessment"
            onPress={onSubmit}
            loading={submitting}
            style={styles.submitBtn}
          />
        )}
      </View>

     
    </View>
  );
};

export default AssessmentReviewScreen;

const skStyles = StyleSheet.create({
  flex1: { flex: 1 },
  scoreLabel: { marginTop: spacing[0.5] },
});
