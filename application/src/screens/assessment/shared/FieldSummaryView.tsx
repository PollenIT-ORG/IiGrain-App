import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import {
  AppHeader,
  AppOverflowMenu,
  AppText,
  Button,
  ConfirmationModal,
} from '../../../components';
import type { OverflowMenuItem } from '../../../components';
import {
  AppShimmer,
  AppShimmerButton,
  AppShimmerCard,
  AppShimmerChip,
  AppShimmerList,
  AppShimmerText,
} from '../../../components/Shimmer';
import { EmptyState } from '../../../components/farms';
import AssessmentSummaryCard from '../../../components/assessment/AssessmentSummaryCard';
import AssessmentLockedModal from '../../../components/assessment/AssessmentLockedModal';
import FieldRegenIndexCard from '../../../components/assessment/FieldRegenIndexCard';
import CategoryProgressList from '../../../components/assessment/CategoryProgressList';
import SectionHeader from '../../../components/assessment/SectionHeader';
import SoilInfoCard from '../../../components/farms/SoilInfoCard';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../../constants';
import { addAlpha, moderateScale, scale } from '../../../utils';
import { useSyncedFetch } from '../../../hooks/useSyncedFetch';
import { Tags } from '../../../redux/syncTags';
import { showSuccess } from '../../../services/toastService';
import type { AssessmentCategory } from '../../../types/assessment';
import {
  isAssessmentComplete,
  toCategoryItems,
  toRegenScoring,
  toSummaryCardModel,
  toSummaryHeaderTitle,
} from '../assessmentPresenter';
import { styles } from '../AssessmentScreenStyle';
import { useAssessmentFlow } from './useAssessmentFlow';
import type { AssessmentRole, FlowNavigation } from './flowTypes';

export interface FieldSummaryViewProps {
  role: AssessmentRole;
  params: { programId: string; fieldId: string; fieldName?: string };
  navigation: FlowNavigation;
}

const FieldSummaryView: React.FC<FieldSummaryViewProps> = ({
  role,
  params,
  navigation,
}) => {
  const { programId, fieldId, fieldName } = params;
  const flow = useAssessmentFlow(role, programId, fieldId);

  const {
    routes,
    supportsDiscard,
    supportsRegenIndex,
    access,
    summary,
    programName,
    categories,
    regenIndex,
    resumePoint,
    submitted,
    error,
    loadedSummaryScope,
    loadedRegenScope,
    answerVersion,
    loadingRegenIndex,
    refreshing,
    discarding,
    loadSummary,
    refreshSummary,
    loadRegenIndex,
    discard,
  } = flow;

  const [discardOpen, setDiscardOpen] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);

  const gated = access.locked && access.resolved && !submitted;

  const openVisit = useCallback(() => {
    if (access.visitId) {
      navigation.navigate('AssessorVisit', { visitId: access.visitId });
    }
  }, [navigation, access.visitId]);

  const scope = `${programId}:${fieldId}`;
  const summaryReady = !!summary && loadedSummaryScope === scope;
  const regenReady = !!regenIndex && loadedRegenScope === scope;

  const target = useMemo(() => ({ programId, fieldId }), [programId, fieldId]);

  useEffect(() => {
    loadSummary(target);
  }, [loadSummary, target]);

  useSyncedFetch({
    tags: [Tags.regen(fieldId)],
    run: useCallback(() => loadRegenIndex(target), [loadRegenIndex, target]),
    hasData: regenReady,
    enabled: supportsRegenIndex && !!programId && !!fieldId,
  });

  useSyncedFetch({
    tags: [Tags.assessmentSummary(fieldId), Tags.assessment(programId, fieldId)],
    run: useCallback(() => loadSummary(target), [loadSummary, target]),
    hasData: summaryReady,
    enabled: !!programId && !!fieldId,
  });

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      loadSummary(target);
      loadRegenIndex(target);
    }, [loadSummary, loadRegenIndex, target]),
  );

  const lastSyncedAnswerVersion = useRef(answerVersion);
  useEffect(() => {
    if (answerVersion === lastSyncedAnswerVersion.current) {
      return;
    }
    lastSyncedAnswerVersion.current = answerVersion;
    loadSummary(target);
    loadRegenIndex(target);
  }, [answerVersion, loadSummary, loadRegenIndex, target]);

  const onRefresh = useCallback(
    () => refreshSummary(target),
    [refreshSummary, target],
  );

  const onRetry = useCallback(() => loadSummary(target), [loadSummary, target]);

  const summaryCard = useMemo(
    () => (summary ? toSummaryCardModel(summary, { submitted, programName }) : null),
    [summary, submitted, programName],
  );
  const categoryItems = useMemo(() => toCategoryItems(categories), [categories]);

  const isComplete = useMemo(
    () => (summary ? isAssessmentComplete(summary) : false),
    [summary],
  );

  const canDiscard =
    !!summary &&
    summary.assessment.status !== 'COMPLETED' &&
    summary.assessment.answered > 0;

  const handleCategoryPress = useCallback(
    (category: AssessmentCategory) => {
      if (gated) {
        setLockedOpen(true);
        return;
      }
      navigation.navigate(routes.category, {
        programId,
        fieldId,
        categoryId: category.id,
        categoryName: category.title,
      });
    },
    [gated, navigation, routes, programId, fieldId],
  );

  const handlePrimaryCta = useCallback(() => {
    if (isComplete) {
      navigation.navigate(routes.review, { programId, fieldId });
      return;
    }
    if (gated) {
      setLockedOpen(true);
      return;
    }
    if (resumePoint) {
      const savedCat = categories.find(c => c.id === resumePoint.categoryId);
      if (savedCat && savedCat.answered < savedCat.totalQuestions) {
        navigation.navigate(routes.question, {
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
      navigation.navigate(routes.category, {
        programId,
        fieldId,
        categoryId: next.id,
        categoryName: next.name,
      });
    }
  }, [
    isComplete,
    gated,
    navigation,
    routes,
    programId,
    fieldId,
    categories,
    resumePoint,
  ]);

  const runDiscard = useCallback(async () => {
    const cleared = await discard(target);
    setDiscardOpen(false);
    if (cleared !== null) {
      showSuccess(
        cleared > 0
          ? `Cleared ${cleared} answer${cleared === 1 ? '' : 's'}`
          : 'Assessment discarded',
      );
    }
  }, [discard, target]);

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
        description: canDiscard ? undefined : 'Nothing saved yet to discard',
      },
    ],
    [canDiscard, discarding],
  );

  const headerTitle = toSummaryHeaderTitle(summaryReady ? summary : null, fieldName);

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
        {summary.field.farmName ? (
          <AppText style={styles.fieldCaption}>{summary.field.farmName}</AppText>
        ) : null}

        {role === 'assessor' && submitted ? (
          <View style={extras.lockBanner}>
            <AppIcon name={ICONS.LOCK_CHECK} size={moderateScale(18)} color={COLORS.primary} />
            <AppText style={extras.lockText}>
              This assessment has been submitted. You can view the answers but can
              no longer edit them.
            </AppText>
          </View>
        ) : null}

        {gated ? (
          <Pressable
            onPress={() => setLockedOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Why is this assessment locked?"
            style={({ pressed }) => [extras.gateBanner, pressed && extras.gatePressed]}>
            <View style={extras.gateIcon}>
              <AppIcon name={ICONS.LOCK} size={moderateScale(18)} color={COLORS.accent} />
            </View>
            <View style={extras.gateTexts}>
              <AppText style={extras.gateTitle}>
                {access.state === 'program_not_open'
                  ? 'Opens once the program office locks the survey'
                  : 'Locked until you reach the field'}
              </AppText>
              <AppText style={extras.gateBody}>
                {access.state === 'program_not_open'
                  ? "No action needed — you'll be able to start as soon as it opens."
                  : access.state === 'en_route'
                  ? 'Mark the visit as arrived once you are on the field to start scoring.'
                  : access.state === 'other_field'
                  ? `Your live visit is for ${access.otherFieldName ?? 'another field'}.`
                  : 'Start a visit for this field and travel there to start scoring.'}
              </AppText>
            </View>
            <AppIcon
              name={ICONS.CHEVRON_RIGHT}
              size={moderateScale(20)}
              color={COLORS.gray500}
            />
          </Pressable>
        ) : null}

        <AssessmentSummaryCard
          summary={summaryCard}
          onContinue={handlePrimaryCta}
          locked={(gated && !isComplete) || summaryCard.surveyClosed}
        />

        <View style={styles.section}>
          <SectionHeader title="Categories" />
          {categoryItems.length > 0 ? (
            <View style={styles.categoriesCard}>
              <CategoryProgressList
                categories={categoryItems}
                onCategoryPress={handleCategoryPress}
                locked={gated}
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

        {supportsRegenIndex ? (
          <FieldRegenIndexCard
            data={regenReady ? regenIndex : null}
            loading={loadingRegenIndex}
            scoring={toRegenScoring(summary)}
          />
        ) : null}

        {role === 'farmer' && summary.reviewStatus === 'approved' ? (
          <Button
            title="Compare with assessor"
            variant="outline"
            fullWidth
            onPress={() =>
              navigation.navigate('FarmerComparison', {
                programId,
                fieldId,
                fieldName: summary.field.name,
              })
            }
            leftIcon={
              <AppIcon name={ICONS.BALANCE} size={moderateScale(18)} color={COLORS.primary} />
            }
          />
        ) : null}

        {role === 'assessor' ? (
          <>
            <SoilInfoCard fieldId={fieldId} />

            <View style={extras.compareRow}>
              <Button
                title="Farmer's answers"
                variant="outline"
                fullWidth={false}
                onPress={() =>
                  navigation.navigate('AssessorFarmerAssessment', {
                    programId,
                    fieldId,
                    fieldName: summary.field.name,
                  })
                }
                leftIcon={
                  <AppIcon
                    name={ICONS.REVIEWER}
                    size={moderateScale(18)}
                    color={COLORS.primary}
                  />
                }
                style={extras.compareBtn}
              />
              <Button
                title="Compare"
                variant="outline"
                fullWidth={false}
                onPress={() =>
                  navigation.navigate('AssessorComparison', {
                    programId,
                    fieldId,
                    fieldName: summary.field.name,
                  })
                }
                leftIcon={
                  <AppIcon
                    name={ICONS.BALANCE}
                    size={moderateScale(18)}
                    color={COLORS.primary}
                  />
                }
                style={extras.compareBtn}
              />
            </View>
          </>
        ) : null}
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
          supportsDiscard ? (
            <AppOverflowMenu
              items={menuItems}
              accessibilityLabel="Assessment actions"
              disabled={!summaryReady}
            />
          ) : undefined
        }
      />

      {renderBody()}

      {supportsDiscard ? (
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
      ) : null}

      {access.state !== 'open' ? (
        <AssessmentLockedModal
          visible={lockedOpen}
          state={access.state}
          fieldName={summary?.field.name ?? fieldName}
          otherFieldName={access.otherFieldName}
          onOpenVisit={access.visitId ? openVisit : undefined}
          onClose={() => setLockedOpen(false)}
        />
      ) : null}
    </View>
  );
};

export default FieldSummaryView;

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

const extras = StyleSheet.create({
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.lg,
    padding: spacing[3.5],
  },
  lockText: {
    ...presets.bodyXS,
    color: COLORS.primaryDark,
    flex: 1,
  },
  compareRow: { flexDirection: 'row', gap: spacing[3] },
  compareBtn: { flex: 1 },

  gateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: addAlpha(COLORS.accent, 0.1),
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.accent, 0.35),
    borderRadius: borderRadius.lg,
    padding: spacing[3.5],
  },
  gatePressed: { opacity: 0.7 },
  gateIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTexts: { flex: 1, gap: spacing[0.5] },
  gateTitle: { ...presets.labelMD, color: COLORS.gray900 },
  gateBody: { ...presets.bodyXS, color: COLORS.gray700 },
});
