import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppStatusBadge, AppText, Button } from '../../components';
import { EmptyState } from '../../components/farms';
import ScorePill from '../../components/assessor/ScorePill';
import {
  AppShimmer,
  AppShimmerChip,
  AppShimmerText,
} from '../../components/Shimmer';
import { COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing, fonts } from '../../constants';
import { addAlpha, moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchComparisonThunk,
  selectAssessorComparison,
  selectAssessorError,
} from '../../redux/slices/assessorSlice';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';
import type { ComparisonQuestion } from '../../types/assessor';

const diffMeta = (q: ComparisonQuestion): { text: string; color: string; icon: string } => {
  if (q.difference === null || q.farmerScore === null || q.assessorScore === null) {
    return { text: '—', color: COLORS.gray500, icon: 'minus' };
  }
  if (q.difference === 0) {
    return { text: 'Match', color: COLORS.success, icon: 'equal' };
  }
  const d = q.difference;
  const color = Math.abs(d) >= 2 ? COLORS.danger : COLORS.warning;
  return { text: `${d > 0 ? '+' : ''}${d}`, color, icon: d > 0 ? 'arrow-up' : 'arrow-down' };
};

const AssessorComparisonScreen: React.FC<AssessorScreenProps<'AssessorComparison'>> = ({
  route,
  navigation,
}) => {
  const { programId, fieldId, fieldName } = route.params;
  const dispatch = useAppDispatch();
  const data = useAppSelector(selectAssessorComparison);
  const error = useAppSelector(selectAssessorError);

  const ready = !!data && data.field.id === fieldId;
  const [attempted, setAttempted] = useState(false);

  const load = useCallback(() => {
    setAttempted(true);
    dispatch(fetchComparisonThunk({ programId, fieldId }));
  }, [dispatch, programId, fieldId]);
  useEffect(() => {
    load();
  }, [load]);

  const title = (ready && data ? data.field.name : fieldName) ?? 'Comparison';

  if (attempted && error && !ready) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title={title} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load the comparison</AppText>
          <AppText style={styles.muted}>{error}</AppText>
          <Button title="Retry" onPress={load} fullWidth={false} style={styles.retry} />
        </View>
      </View>
    );
  }

  if (!ready || !data) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title={title} onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryCol}>
              <AppShimmer width="55%" height={moderateScale(12)} radius={borderRadius.sm} />
              <AppShimmer width="60%" height={moderateScale(28)} radius={borderRadius.sm} />
              <AppShimmerChip />
            </View>
            <View style={styles.vDivider} />
            <View style={styles.summaryCol}>
              <AppShimmer width="55%" height={moderateScale(12)} radius={borderRadius.sm} />
              <AppShimmer width="60%" height={moderateScale(28)} radius={borderRadius.sm} />
              <AppShimmerChip />
            </View>
          </View>
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.card}>
              <AppShimmer width="25%" height={moderateScale(10)} radius={borderRadius.sm} />
              <AppShimmerText count={2} width="90%" lastLineWidth="60%" />
              <View style={styles.compareRow}>
                <View style={styles.scoreCol}>
                  <AppShimmer width={moderateScale(36)} height={moderateScale(10)} radius={borderRadius.sm} />
                  <AppShimmer width={moderateScale(40)} height={moderateScale(24)} radius={borderRadius.full} />
                </View>
                <View style={styles.scoreCol}>
                  <AppShimmer width={moderateScale(36)} height={moderateScale(10)} radius={borderRadius.sm} />
                  <AppShimmer width={moderateScale(40)} height={moderateScale(24)} radius={borderRadius.full} />
                </View>
                <AppShimmer width={moderateScale(48)} height={moderateScale(24)} radius={borderRadius.full} style={styles.loadingDiff} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const hasQuestions = data.categories.some(c => c.questions.length > 0);

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryCol}>
            <AppText style={styles.sideLabel}>Farmer</AppText>
            <AppText style={styles.bigPct}>{Math.round(data.farmer.percentage)}%</AppText>
            <AppStatusBadge
              tone={data.farmer.submitted ? 'success' : 'neutral'}
              label={data.farmer.submitted ? 'Submitted' : 'Not submitted'}
              size="sm"
              style={styles.centerBadge}
            />
          </View>
          <View style={styles.vDivider} />
          <View style={styles.summaryCol}>
            <AppText style={styles.sideLabel}>You</AppText>
            <AppText style={[styles.bigPct, styles.bigPctYou]}>{Math.round(data.assessor.percentage)}%</AppText>
            <AppStatusBadge
              tone={data.assessor.submitted ? 'success' : 'neutral'}
              label={data.assessor.submitted ? 'Submitted' : 'Not submitted'}
              size="sm"
              style={styles.centerBadge}
            />
          </View>
        </View>

        {hasQuestions ? (
          data.categories.map(cat => (
            <View key={cat.id} style={styles.category}>
              <AppText style={styles.categoryTitle}>{cat.name}</AppText>
              {cat.questions.map(q => {
                const diff = diffMeta(q);
                return (
                  <View key={q.id} style={styles.card}>
                    {q.code ? <AppText style={styles.code}>{q.code}</AppText> : null}
                    <AppText style={styles.text}>{q.text}</AppText>
                    <View style={styles.compareRow}>
                      <View style={styles.scoreCol}>
                        <AppText style={styles.scoreLabel}>Farmer</AppText>
                        <ScorePill score={q.farmerScore} />
                      </View>
                      <View style={styles.scoreCol}>
                        <AppText style={styles.scoreLabel}>You</AppText>
                        <ScorePill score={q.assessorScore} />
                      </View>
                      <View style={[styles.diffChip, { backgroundColor: addAlpha(diff.color, 0.14) }]}>
                        <AppIcon name={diff.icon} size={moderateScale(13)} color={diff.color} />
                        <AppText style={[styles.diffText, { color: diff.color }]}>{diff.text}</AppText>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        ) : (
          <EmptyState
            icon="scale-balance"
            title="Nothing to compare yet"
            message="Once both the farmer and you have answered, the comparison appears here."
          />
        )}
      </ScrollView>
    </View>
  );
};

export default AssessorComparisonScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  body: { padding: spacing[4], paddingBottom: spacing[10] },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    marginBottom: spacing[5],
    ...shadows.md,
  },
  summaryCol: { flex: 1, alignItems: 'center', gap: spacing[1] },
  vDivider: { width: borderWidth.thin, alignSelf: 'stretch', backgroundColor: COLORS.gray200, marginHorizontal: spacing[2] },
  sideLabel: { ...presets.labelSM, color: COLORS.gray600 },
  bigPct: { ...presets.displaySmall, color: COLORS.gray900 },
  bigPctYou: { color: COLORS.primary },
  centerBadge: { alignSelf: 'center' },
  category: { marginBottom: spacing[4] },
  categoryTitle: { ...presets.headingXS, color: COLORS.gray900, marginBottom: spacing[2] },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    marginBottom: spacing[3],
    gap: spacing[2],
    ...shadows.sm,
  },
  code: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.gray500 },
  text: { ...presets.labelMD, color: COLORS.gray900 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], marginTop: spacing[1] },
  loadingDiff: { marginLeft: 'auto' },
  scoreCol: { alignItems: 'center', gap: spacing[1] },
  scoreLabel: { ...presets.caption, color: COLORS.gray600 },
  diffChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginLeft: 'auto',
    borderRadius: borderRadius.full, paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
  },
  diffText: { ...presets.labelSM, fontFamily: fonts.semibold },
  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4], textAlign: 'center' },
  muted: { ...presets.bodySM, color: COLORS.gray500, textAlign: 'center' },
  retry: { marginTop: spacing[4], minWidth: moderateScale(160) },
});
