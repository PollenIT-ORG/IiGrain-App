import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import {
  AppHeader,
  AppOverflowMenu,
  AppText,
  Button,
  ConfirmationModal,
} from '../../components';
import type { OverflowMenuItem } from '../../components';
import {
  AppShimmer,
  AppShimmerButton,
  AppShimmerCard,
  AppShimmerChip,
  AppShimmerList,
  AppShimmerText,
} from '../../components/Shimmer';
import { EmptyState } from '../../components/farms';
import AssessmentSummaryCard from '../../components/assessment/AssessmentSummaryCard';
import FieldRegenIndexCard from '../../components/assessment/FieldRegenIndexCard';
import CategoryProgressList from '../../components/assessment/CategoryProgressList';
import SectionHeader from '../../components/assessment/SectionHeader';
import { COLORS, borderRadius, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
import {
  fetchAssessmentSummaryThunk,
  refreshAssessmentSummaryThunk,
  fetchFieldRegenIndexThunk,
  discardAssessmentThunk,
  selectAnswerVersion,
  selectAssessmentCategories,
  selectAssessmentDiscarding,
  selectAssessmentError,
  selectAssessmentRefreshing,
  selectAssessmentSummary,
  selectFieldRegenIndex,
  selectRegenIndexLoading,
  selectLoadedSummaryScope,
  selectLoadedRegenScope,
} from '../../redux/slices/assessmentSlice';
import {
  clearResumePoint,
  selectResumePoint,
} from '../../redux/slices/assessmentProgressSlice';
import { showSuccess } from '../../services/toastService';
import type { AssessmentCategory } from '../../types/assessment';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import { isAssessmentComplete, toCategoryItems, toSummaryCardModel } from './assessmentPresenter';
import { styles } from './AssessmentScreenStyle';

/**
 * One field's assessment: progress card, its categories, the regen index, and
 * the discard action. Split out of the Assessment tab so the tab stays a plain
 * list and this view can own a proper header.
 */
const AssessmentFieldSummaryScreen: React.FC<
  AppScreenProps<'AssessmentFieldSummary'>
> = ({ route, navigation }) => {
  const { programId, fieldId, fieldName } = route.params;
  const dispatch = useAppDispatch();

  const summary = useAppSelector(selectAssessmentSummary);
  const categories = useAppSelector(selectAssessmentCategories);
  const refreshing = useAppSelector(selectAssessmentRefreshing);
  const error = useAppSelector(selectAssessmentError);
  const regenIndex = useAppSelector(selectFieldRegenIndex);
  const regenIndexLoading = useAppSelector(selectRegenIndexLoading);
  const loadedSummaryScope = useAppSelector(selectLoadedSummaryScope);
  const loadedRegenScope = useAppSelector(selectLoadedRegenScope);
  const answerVersion = useAppSelector(selectAnswerVersion);
  const discarding = useAppSelector(selectAssessmentDiscarding);

  const [discardOpen, setDiscardOpen] = useState(false);

  const scope = `${programId}:${fieldId}`;
  const summaryReady = !!summary && loadedSummaryScope === scope;
  const regenReady = !!regenIndex && loadedRegenScope === scope;

  const target = useMemo(() => ({ programId, fieldId }), [programId, fieldId]);

  // Refetch once per mount, unconditionally. Cached data still paints straight
  // away (see `summaryReady`), so this is a background refresh — and it matters
  // because finishing a category resets the stack, which remounts this screen:
  // the summary counts are updated optimistically by the save reducer, but the
  // regen index is not, so without this it would show stale scores.
  useEffect(() => {
    dispatch(fetchAssessmentSummaryThunk(target));
  }, [dispatch, target]);

  // FOCUS-GATED — see the matching comment in AssessmentReviewScreen. Both
  // screens share the single `regenIndex` slot and are mounted at the same time,
  // so an unfocused screen must never pull the slot back to its own field or the
  // two refetch each other forever (the RHI card flicker).
  useSyncedFetch({
    tags: [Tags.regen(fieldId)],
    run: useCallback(
      () => dispatch(fetchFieldRegenIndexThunk(target)),
      [dispatch, target],
    ),
    hasData: regenReady,
    enabled: !!programId && !!fieldId,
  });

  // Answers saved deeper in the flow (categories → questions) come back here,
  // so refetch on focus — but never on the very first one, which the effects
  // above already cover.
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      dispatch(fetchAssessmentSummaryThunk(target));
      dispatch(fetchFieldRegenIndexThunk(target));
    }, [dispatch, target]),
  );

  // Safety net for a save that lands while this screen is already focused.
  const lastSyncedAnswerVersion = useRef(answerVersion);
  useEffect(() => {
    if (answerVersion === lastSyncedAnswerVersion.current) {
      return;
    }
    lastSyncedAnswerVersion.current = answerVersion;
    dispatch(fetchAssessmentSummaryThunk(target));
    dispatch(fetchFieldRegenIndexThunk(target));
  }, [answerVersion, dispatch, target]);

  const onRefresh = useCallback(
    () => dispatch(refreshAssessmentSummaryThunk(target)),
    [dispatch, target],
  );

  const onRetry = useCallback(
    () => dispatch(fetchAssessmentSummaryThunk(target)),
    [dispatch, target],
  );

  const summaryCard = useMemo(
    () => (summary ? toSummaryCardModel(summary) : null),
    [summary],
  );
  const categoryItems = useMemo(() => toCategoryItems(categories), [categories]);

  const isComplete = useMemo(
    () => (summary ? isAssessmentComplete(summary) : false),
    [summary],
  );

  // Only an unsubmitted assessment with saved answers can be discarded; the
  // backend rejects the rest with a 409.
  const canDiscard =
    !!summary &&
    summary.assessment.status !== 'COMPLETED' &&
    summary.assessment.answered > 0;

  const resumePoint = useAppSelector(selectResumePoint(programId, fieldId));

  const handleCategoryPress = useCallback(
    (category: AssessmentCategory) => {
      navigation.navigate('AssessmentCategory', {
        programId,
        fieldId,
        categoryId: category.id,
        categoryName: category.title,
      });
    },
    [navigation, programId, fieldId],
  );

  const handlePrimaryCta = useCallback(() => {
    if (isComplete) {
      navigation.navigate('AssessmentReview', { programId, fieldId });
      return;
    }
    if (resumePoint) {
      const savedCat = categories.find(c => c.id === resumePoint.categoryId);
      if (savedCat && savedCat.answered < savedCat.totalQuestions) {
        navigation.navigate('AssessmentQuestionDetail', {
          programId,
          fieldId,
          categoryId: savedCat.id,
          questionId: resumePoint.questionId,
        });
        return;
      }
    }
    const next = categories.find(c => c.answered < c.totalQuestions) ?? categories[0];
    if (next) {
      navigation.navigate('AssessmentCategory', {
        programId,
        fieldId,
        categoryId: next.id,
        categoryName: next.name,
      });
    }
  }, [isComplete, navigation, programId, fieldId, categories, resumePoint]);

  const runDiscard = useCallback(async () => {
    // A 409 (already submitted) surfaces through the global error modal with the
    // message the backend returned.
    const action = await dispatch(discardAssessmentThunk(target));
    // Close before the toast: a root-level toast renders behind an open modal.
    setDiscardOpen(false);
    if (discardAssessmentThunk.fulfilled.match(action)) {
      dispatch(clearResumePoint(target));
      const cleared = action.payload.discardedAnswers;
      showSuccess(
        cleared > 0
          ? `Cleared ${cleared} answer${cleared === 1 ? '' : 's'}`
          : 'Assessment discarded',
      );
    }
  }, [dispatch, target]);

  const menuItems = useMemo<OverflowMenuItem[]>(
    () => [
      {
        key: 'discard',
        icon: 'delete-sweep-outline',
        title: 'Discard Assessment',
        onPress: () => setDiscardOpen(true),
        destructive: true,
        loading: discarding,
        disabled: !canDiscard,
        description: canDiscard
          ? undefined
          : 'Nothing saved yet to discard',
      },
    ],
    [canDiscard, discarding],
  );

  const headerTitle = summaryReady
    ? summary?.assessment.title || fieldName || 'Assessment'
    : fieldName || 'Assessment';

  const renderSkeleton = () => (
    <View style={styles.body}>
      <AppShimmerText width="60%" height={moderateScale(12)} />

      <AppShimmerCard style={skStyles.cardGap}>
        <View style={skStyles.titleRow}>
          <AppShimmerText width="55%" height={moderateScale(16)} />
          <AppShimmerChip width={scale(80)} />
        </View>
        <AppShimmerText width="45%" height={moderateScale(11)} />
        <AppShimmerText width={scale(120)} height={moderateScale(20)} />
        <AppShimmer width="100%" height={scale(8)} radius={borderRadius.full} />
        <AppShimmerButton />
      </AppShimmerCard>

      <View style={styles.section}>
        <AppShimmerText width={scale(120)} height={moderateScale(14)} />
        <View style={styles.categoriesCard}>
          <AppShimmerList
            count={4}
            renderItem={() => (
              <View style={skStyles.categoryRow}>
                <AppShimmer width={scale(36)} height={scale(36)} radius={borderRadius.md} />
                <View style={skStyles.rowBody}>
                  <AppShimmerText width="55%" height={moderateScale(13)} />
                  <AppShimmer width="100%" height={scale(6)} radius={borderRadius.full} />
                </View>
              </View>
            )}
          />
        </View>
      </View>
    </View>
  );

  const renderBody = () => {
    if (error && !summaryReady) {
      return (
        <View style={styles.stateCenter}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load</AppText>
          <AppText style={styles.stateMessage}>{error}</AppText>
          <Button title="Retry" onPress={onRetry} fullWidth={false} style={styles.retryBtn} />
        </View>
      );
    }

    if (!summary || !summaryCard || !summaryReady) {
      return renderSkeleton();
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
        <AppText style={styles.fieldCaption}>
          {summary.field.farmName} - {summary.field.name}
        </AppText>

        <AssessmentSummaryCard summary={summaryCard} onContinue={handlePrimaryCta} />

        <View style={styles.section}>
          <SectionHeader title="Categories" />
          {categoryItems.length > 0 ? (
            <View style={styles.categoriesCard}>
              <CategoryProgressList
                categories={categoryItems}
                onCategoryPress={handleCategoryPress}
              />
            </View>
          ) : (
            <EmptyState
              icon="clipboard-text-outline"
              title="No categories yet"
              message="This assessment has no categories to show."
            />
          )}
        </View>

        <FieldRegenIndexCard
          data={regenReady ? regenIndex : null}
          loading={regenIndexLoading}
        />
      </ScrollView>
    );
  };

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title={headerTitle}
        onBack={() => navigation.goBack()}
        rightActions={null}
        rightComponent={
          <AppOverflowMenu
            items={menuItems}
            accessibilityLabel="Assessment actions"
            disabled={!summaryReady}
          />
        }
      />

      {renderBody()}

      <ConfirmationModal
        visible={discardOpen}
        tone="danger"
        icon="delete-sweep-outline"
        title="Discard this assessment?"
        message="Every answer saved for this field is cleared so the assessment can be started fresh. This cannot be undone."
        consequences={[
          `All ${summary?.assessment.answered ?? 0} saved answer${
            summary?.assessment.answered === 1 ? '' : 's'
          }`,
          'Any evidence and comments attached to them',
          'Your progress across every category',
        ]}
        retains={['The field and its program enrolment', 'The assessment itself']}
        confirmLabel="Discard"
        loading={discarding}
        onConfirm={runDiscard}
        onCancel={() => setDiscardOpen(false)}
      />
    </View>
  );
};

export default AssessmentFieldSummaryScreen;

const skStyles = StyleSheet.create({
  cardGap: { gap: spacing[3] },
  rowBody: { flex: 1, gap: spacing[1.5] },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
});
