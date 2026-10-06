import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../../components';
import { AppShimmer, AppShimmerText } from '../../../components/Shimmer';
import AssessmentProgressBar from '../../../components/assessment/AssessmentProgressBar';
import AssessmentSubmitSuccess from '../../../components/assessment/AssessmentSubmitSuccess';
import FieldRegenIndexCard from '../../../components/assessment/FieldRegenIndexCard';
import { COLORS, spacing } from '../../../constants';
import { moderateScale, scale } from '../../../utils';
import { useSyncedFetch } from '../../../hooks/useSyncedFetch';
import { Tags } from '../../../redux/syncTags';
import { showToast } from '../../../services/toastService';
import type {
  AssessmentReviewQuestion,
  QuestionScore,
} from '../../../types/assessment';
import { toReviewRegenScoring } from '../assessmentPresenter';
import { styles } from '../AssessmentReviewScreenStyle';
import { useAssessmentFlow } from './useAssessmentFlow';
import type { AssessmentRole, FlowNavigation } from './flowTypes';

const pct = (value: number): string => `${Math.round(value)}%`;

const SCORE_META: Record<QuestionScore, { label: string; color: string }> = {
  0: { label: 'Basic', color: COLORS.danger },
  1: { label: 'Beginning', color: '#EF9A2E' },
  2: { label: 'Developing', color: '#2F6FED' },
  3: { label: 'Advanced', color: '#2E9E5B' },
};

const formatAnswerText = (question: AssessmentReviewQuestion): string => {
  if (!question.answered) {
    return '—';
  }
  switch (question.questionType) {
    case 'mcq':
      return question.optionText ?? '—';
    case 'text':
    case 'long_text':
      return question.answerText ?? '—';
    case 'number':
      return question.answerNumber !== null ? String(question.answerNumber) : '—';
    case 'date':
      return question.answerDate ?? '—';
    case 'boolean':
      return question.answerBoolean === null ? '—' : question.answerBoolean ? 'Yes' : 'No';
    default:
      return '—';
  }
};

interface AnswerDisplay {
  text: string;
  label: string;
  color: string;
}

const answerDisplayFor = (
  question: AssessmentReviewQuestion,
  hideScore: boolean,
): AnswerDisplay => {
  if (hideScore) {
    return { text: '···', label: 'In review', color: COLORS.gray500 };
  }
  if (!question.answered) {
    return { text: '—', label: 'Pending', color: COLORS.gray500 };
  }
  if (question.questionType === 'scored' && question.score !== null) {
    const meta = SCORE_META[question.score];
    return { text: String(question.score), label: meta.label, color: meta.color };
  }
  const finalScore = question.finalScore ?? question.reviewScore;
  if (finalScore !== null && finalScore !== undefined) {
    return { text: String(finalScore), label: 'Scored', color: COLORS.primary };
  }
  return { text: formatAnswerText(question), label: 'Answered', color: COLORS.gray700 };
};

const QuestionCard: React.FC<{
  question: AssessmentReviewQuestion;
  hideScore: boolean;
  onPress?: () => void;
}> = ({ question, hideScore, onPress }) => {
  const display = answerDisplayFor(question, hideScore);

  const content = (
    <>
      <AppText style={styles.qText} numberOfLines={2}>
        {question.code ? `${question.code}. ` : ''}
        {question.text}
      </AppText>

      <View style={styles.qScoreBox}>
        <AppText style={[styles.qScore, { color: display.color }]} numberOfLines={1}>
          {display.text}
        </AppText>
        <AppText style={styles.qScoreLabel}>{display.label}</AppText>
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

export interface ReviewViewProps {
  role: AssessmentRole;
  params: { programId: string; fieldId: string; locked?: boolean };
  navigation: FlowNavigation;
}

const ReviewView: React.FC<ReviewViewProps> = ({ role, params, navigation }) => {
  const { programId, fieldId, locked: forcedLock } = params;
  const scope = `${programId}:${fieldId}`;
  const insets = useSafeAreaInsets();
  const flow = useAssessmentFlow(role, programId, fieldId);

  const {
    routes,
    supportsRegenIndex,
    review,
    submitResult,
    regenIndex,
    error,
    loadedReviewScope,
    loadedRegenScope,
    answerVersion,
    loadingReview: loading,
    loadingRegenIndex: regenIndexLoading,
    submitting,
    loadSummary,
    loadReview,
    loadFieldHistory,
    loadRegenIndex,
    submitAssessment,
    clearSubmitResult,
    goToAssessmentList,
  } = flow;

  const refetchReview = useCallback(
    (s: { programId: string; fieldId: string }) => {
      if (forcedLock) {
        loadFieldHistory(s);
      } else {
        loadReview(s);
      }
    },
    [forcedLock, loadReview, loadFieldHistory],
  );

  const ready = !!review && loadedReviewScope === scope;

  useEffect(() => {
    if (!ready) {
      refetchReview({ programId, fieldId });
    }
  }, [refetchReview, programId, fieldId, ready]);

  const regenReady = !!regenIndex && loadedRegenScope === scope;
  useSyncedFetch({
    tags: [Tags.regen(fieldId)],
    run: useCallback(
      () => loadRegenIndex({ programId, fieldId }),
      [loadRegenIndex, programId, fieldId],
    ),
    hasData: regenReady,
    enabled: supportsRegenIndex && !!programId && !!fieldId,
  });

  useSyncedFetch({
    tags: [Tags.assessment(programId, fieldId)],
    run: useCallback(
      () => refetchReview({ programId, fieldId }),
      [refetchReview, programId, fieldId],
    ),
    hasData: ready,
    enabled: !!programId && !!fieldId,
  });

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      refetchReview({ programId, fieldId });
      loadRegenIndex({ programId, fieldId });
    }, [refetchReview, loadRegenIndex, programId, fieldId]),
  );

  const lastSyncedAnswerVersion = useRef(answerVersion);
  useEffect(() => {
    if (answerVersion === lastSyncedAnswerVersion.current) {
      return;
    }
    lastSyncedAnswerVersion.current = answerVersion;
    refetchReview({ programId, fieldId });
    loadRegenIndex({ programId, fieldId });
  }, [answerVersion, refetchReview, loadRegenIndex, programId, fieldId]);

  const submission = review?.submission;
  const allAnswered =
    !!submission &&
    submission.totalQuestions > 0 &&
    submission.answered >= submission.totalQuestions;
  const isLocked = forcedLock === true || !!submission?.submittedAtISO;
  const headerTitle = forcedLock === true ? 'Assessment Result' : 'Review & Submit';
  const inReview = submission?.reviewStatus === 'in_review';
  const isApproved = submission?.reviewStatus === 'approved';

  const showSuccess = !!submitResult && submitResult.field.id === fieldId;

  const onRetry = useCallback(() => {
    refetchReview({ programId, fieldId });
  }, [refetchReview, programId, fieldId]);

  const openQuestion = useCallback(
    (categoryId: string, questionId: string) => {
      navigation.navigate(routes.question, {
        programId,
        fieldId,
        categoryId,
        questionId,
      });
    },
    [navigation, routes, programId, fieldId],
  );

  const onSubmit = useCallback(async () => {
    if (!allAnswered) {
      showToast('Answer every question before submitting.', { type: 'error' });
      return;
    }
    await submitAssessment({ programId, fieldId });
  }, [allAnswered, submitAssessment, programId, fieldId]);

  const onDone = useCallback(() => {
    clearSubmitResult();
    loadSummary({ programId, fieldId });
    goToAssessmentList(navigation);
  }, [clearSubmitResult, loadSummary, goToAssessmentList, programId, fieldId, navigation]);

  const submitResultInReview = submitResult?.reviewStatus === 'in_review';

  const successScore = useMemo(
    () =>
      submitResult && !submitResultInReview
        ? `${submitResult.totalScore} / ${submitResult.maxScore}`
        : undefined,
    [submitResult, submitResultInReview],
  );

  const successMessage = submitResultInReview
    ? `${review?.field.name ?? 'This field'} is now in review. You'll be notified once it's scored.`
    : `${review?.field.name ?? 'This field'} is now locked for review.`;

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
        rightActions={null}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {supportsRegenIndex ? (
          <View style={styles.regenSection}>
            <FieldRegenIndexCard
              data={regenReady ? regenIndex : null}
              loading={regenIndexLoading}
              scoring={toReviewRegenScoring(review)}
            />
          </View>
        ) : null}
        {review.categories.map(category => (
          <View key={category.id}>
            <AppText style={styles.sectionHeader}>Section: {category.name}</AppText>
            {category.questions.map(question => (
              <QuestionCard
                key={question.id}
                question={question}
                hideScore={inReview}
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
          message={successMessage}
          scoreLabel={successScore}
          percentLabel={
            submitResult && !submitResultInReview ? pct(submitResult.percentage) : undefined
          }
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
            <AppIcon
              name={inReview ? ICONS.INFO : ICONS.LOCK_CHECK}
              size={moderateScale(18)}
              color={COLORS.primary}
            />
            <AppText style={styles.lockNoteText}>
              {inReview
                ? 'In review — not yet scored'
                : isApproved && review.submission.reviewNote
                  ? `Reviewed: ${review.submission.reviewNote}`
                  : 'Submitted & locked'}
            </AppText>
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

export default ReviewView;

const skStyles = StyleSheet.create({
  flex1: { flex: 1 },
  scoreLabel: { marginTop: spacing[0.5] },
});
