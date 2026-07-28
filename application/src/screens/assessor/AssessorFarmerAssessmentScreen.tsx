import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import { EmptyState } from '../../components/farms';
import ScorePill from '../../components/assessor/ScorePill';
import {
  AppShimmer,
  AppShimmerText,
} from '../../components/Shimmer';
import { COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing, fonts } from '../../constants';
import { addAlpha, formatDate, moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchFarmerAssessmentThunk,
  selectAssessorError,
  selectAssessorFarmerAssessment,
} from '../../redux/slices/assessorSlice';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const AssessorFarmerAssessmentScreen: React.FC<AssessorScreenProps<'AssessorFarmerAssessment'>> = ({
  route,
  navigation,
}) => {
  const { programId, fieldId, fieldName } = route.params;
  const dispatch = useAppDispatch();
  const data = useAppSelector(selectAssessorFarmerAssessment);
  const error = useAppSelector(selectAssessorError);

  const ready = !!data && data.field.id === fieldId;
  const [attempted, setAttempted] = useState(false);

  const load = useCallback(() => {
    setAttempted(true);
    dispatch(fetchFarmerAssessmentThunk({ programId, fieldId }));
  }, [dispatch, programId, fieldId]);
  useEffect(() => {
    load();
  }, [load]);

  const title = (ready && data ? data.field.name : fieldName) ?? "Farmer's Assessment";

  if (attempted && error && !ready) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title={title} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load the farmer's assessment</AppText>
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
          <AppShimmer height={moderateScale(44)} radius={borderRadius.lg} style={styles.loadingBanner} />
          <AppShimmer width="40%" height={moderateScale(14)} radius={borderRadius.sm} style={styles.loadingCatTitle} />
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={styles.card}>
              <View style={styles.rowTop}>
                <View style={styles.qText}>
                  <AppShimmer width="25%" height={moderateScale(10)} radius={borderRadius.sm} />
                  <AppShimmerText count={2} width="90%" lastLineWidth="65%" />
                </View>
                <AppShimmer width={moderateScale(40)} height={moderateScale(24)} radius={borderRadius.full} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const hasAnswers = data.categories.some(c => c.questions.length > 0);

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.banner, data.farmerSubmitted ? styles.bannerDone : styles.bannerPending]}>
          <AppIcon
            name={data.farmerSubmitted ? 'account-check' : 'account-clock-outline'}
            size={moderateScale(18)}
            color={data.farmerSubmitted ? COLORS.primary : COLORS.gray600}
          />
          <AppText style={styles.bannerText}>
            {data.farmerSubmitted
              ? `Farmer submitted on ${formatDate(data.submittedAtISO ?? '')}`
              : 'The farmer has not submitted their self-assessment yet.'}
          </AppText>
        </View>

        {hasAnswers ? (
          data.categories.map(cat => (
            <View key={cat.id} style={styles.category}>
              <AppText style={styles.categoryTitle}>{cat.name}</AppText>
              {cat.questions.map(q => (
                <View key={q.id} style={styles.card}>
                  <View style={styles.rowTop}>
                    <View style={styles.qText}>
                      {q.code ? <AppText style={styles.code}>{q.code}</AppText> : null}
                      <AppText style={styles.text}>{q.text}</AppText>
                    </View>
                    <ScorePill score={q.score} />
                  </View>
                  {q.comment ? <AppText style={styles.comment}>“{q.comment}”</AppText> : null}
                  {q.evidenceUrls.length > 0 ? (
                    <View style={styles.evidenceChip}>
                      <AppIcon name={ICONS.EVIDENCE} size={moderateScale(13)} color={COLORS.primary} />
                      <AppText style={styles.evidenceText}>
                        {q.evidenceUrls.length} evidence file{q.evidenceUrls.length === 1 ? '' : 's'}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ))
        ) : (
          <EmptyState
            icon="clipboard-text-outline"
            title="No answers"
            message="The farmer hasn't answered any questions for this field yet."
          />
        )}
      </ScrollView>
    </View>
  );
};

export default AssessorFarmerAssessmentScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  body: { padding: spacing[4], paddingBottom: spacing[10] },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    borderRadius: borderRadius.lg, padding: spacing[3], marginBottom: spacing[4],
  },
  bannerDone: { backgroundColor: COLORS.lightPrimary },
  bannerPending: { backgroundColor: COLORS.gray100 },
  bannerText: { ...presets.bodySM, color: COLORS.gray900, flexShrink: 1 },
  category: { marginBottom: spacing[4] },
  loadingBanner: { marginBottom: spacing[4] },
  loadingCatTitle: { marginBottom: spacing[2] },
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
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3] },
  qText: { flex: 1, gap: spacing[0.5] },
  code: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.gray500 },
  text: { ...presets.labelMD, color: COLORS.gray900 },
  comment: { ...presets.bodySM, color: COLORS.gray700, fontStyle: 'italic' },
  evidenceChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5], alignSelf: 'flex-start',
    backgroundColor: addAlpha(COLORS.primary, 0.1), borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
  },
  evidenceText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.primaryDark },
  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4], textAlign: 'center' },
  muted: { ...presets.bodySM, color: COLORS.gray500, textAlign: 'center' },
  retry: { marginTop: spacing[4], minWidth: moderateScale(160) },
});
