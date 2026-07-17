import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import { AppShimmer, AppShimmerText } from '../../components/Shimmer';
import AssessmentProgressBar from '../../components/assessment/AssessmentProgressBar';
import AssessmentSubmitSuccess from '../../components/assessment/AssessmentSubmitSuccess';
import { COLORS, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  clearSubmitResult,
  fetchAssessmentReviewThunk,
  fetchAssessmentSummaryThunk,
  selectAssessmentError,
  selectAssessmentReview,
  selectAssessmentSubmitResult,
  selectAssessmentSubmitting,
  selectReviewLoading,
  submitAssessmentThunk,
} from '../../redux/slices/assessmentSlice';
import { showToast } from '../../services/toastService';
import type {
  AssessmentReviewQuestion,
  QuestionScore,
} from '../../types/assessment';
import type { AppScreenProps } from '../../navigation/navigationTypes';
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
          {meta ? question.score : '-'}
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
  const { fieldId, locked: forcedLock } = route.params;
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();

  const review = useAppSelector(selectAssessmentReview);
  const loading = useAppSelector(selectReviewLoading);
  const submitting = useAppSelector(selectAssessmentSubmitting);
  const submitResult = useAppSelector(selectAssessmentSubmitResult);
  const error = useAppSelector(selectAssessmentError);

  const ready = !!review && review.field.id === fieldId;

  useEffect(() => {
    if (!ready) {
      dispatch(fetchAssessmentReviewThunk(fieldId));
    }
  }, [dispatch, fieldId, ready]);

  const submission = review?.submission;
  const allAnswered =
    !!submission &&
    submission.totalQuestions > 0 &&
    submission.answered >= submission.totalQuestions;
  const isLocked = forcedLock === true || !!submission?.submittedAtISO;
  const headerTitle = forcedLock === true ? 'Assessment Result' : 'Review & Submit';

  const showSuccess = !!submitResult && submitResult.field.id === fieldId;

  const onRetry = useCallback(() => {
    dispatch(fetchAssessmentReviewThunk(fieldId));
  }, [dispatch, fieldId]);

  const openQuestion = useCallback(
    (categoryId: string, questionId: string) => {
      navigation.navigate('AssessmentQuestionDetail', { fieldId, categoryId, questionId });
    },
    [navigation, fieldId],
  );

  const onSubmit = useCallback(async () => {
    if (!allAnswered) {
      showToast('Answer every question before submitting.', { type: 'error' });
      return;
    }
    await dispatch(submitAssessmentThunk(fieldId));
  }, [allAnswered, dispatch, fieldId]);

  const onDone = useCallback(() => {
    dispatch(clearSubmitResult());
    dispatch(fetchAssessmentSummaryThunk(fieldId));
    navigation.navigate('Shell', {
      screen: 'MainTabs',
      params: { screen: 'Assessment', params: { fieldId } },
    });
  }, [dispatch, fieldId, navigation]);

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
        rightActions={['filter']}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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

      <AssessmentSubmitSuccess
        visible={showSuccess}
        title="Assessment Submitted"
        message={`${review.field.name} is now locked for review.`}
        scoreLabel={successScore}
        percentLabel={submitResult ? pct(submitResult.percentage) : undefined}
        onDone={onDone}
      />
    </View>
  );
};

export default AssessmentReviewScreen;

const skStyles = StyleSheet.create({
  flex1: { flex: 1 },
  scoreLabel: { marginTop: spacing[0.5] },
});
