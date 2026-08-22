import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import AssessorFieldCard from '../../components/assessor/AssessorFieldCard';
import { EmptyState, SectionHeader } from '../../components/farms';
import {
  AppShimmer,
  AppShimmerChip,
  AppShimmerCircle,
  AppShimmerList,
  AppShimmerSection,
} from '../../components/Shimmer';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useAssessorOverviewSync } from '../../hooks/useAssessorOverviewSync';
import {
  fetchAssessorFieldsThunk,
  selectAssessorError,
  selectAssessorFieldsOverview,
  selectAssessorFieldsOverviewLoading,
} from '../../redux/slices/assessorSlice';
import {
  fetchMyAssessorVisitThunk,
  selectActiveVisit,
  startVisitThunk,
} from '../../redux/slices/visitSlice';
import { showToast } from '../../services/toastService';
import { ensureTrackingLocation } from '../../services/locationGate';
import { deriveFarmFields } from '../../redux/derive/assessorDerive';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';
import type { AssessorFieldEntry } from '../../types/assessor';

const AssessorFarmDetailScreen: React.FC<AssessorScreenProps<'AssessorFarmDetail'>> = ({
  route,
  navigation,
}) => {
  const { farmId, farmName } = route.params;
  const dispatch = useAppDispatch();
  const overview = useAppSelector(selectAssessorFieldsOverview);
  const loading = useAppSelector(selectAssessorFieldsOverviewLoading);
  const error = useAppSelector(selectAssessorError);
  const activeVisit = useAppSelector(selectActiveVisit);
  const [startingFieldId, setStartingFieldId] = useState<string | null>(null);

  const items = useMemo(
    () => (overview ? deriveFarmFields(overview, farmId) : []),
    [overview, farmId],
  );

  useAssessorOverviewSync(!!overview);

  useEffect(() => {
    dispatch(fetchMyAssessorVisitThunk());
  }, [dispatch]);

  const onRefresh = useCallback(() => dispatch(fetchAssessorFieldsThunk()), [dispatch]);

  const openField = useCallback(
    (entry: AssessorFieldEntry) =>
      navigation.navigate('AssessorAssessmentSummary', {
        programId: entry.program.id,
        fieldId: entry.field.id,
        fieldName: entry.field.name,
      }),
    [navigation],
  );

  const onStartVisit = useCallback(
    async (entry: AssessorFieldEntry) => {
      if (activeVisit && activeVisit.fieldId === entry.field.id) {
        navigation.navigate('AssessorVisit', { visitId: activeVisit.id });
        return;
      }
      setStartingFieldId(entry.field.id);
      const fix = await ensureTrackingLocation({
        purpose: 'share your live position with the farmer during this visit',
      });
      if (!fix) {
        setStartingFieldId(null);
        return;
      }
      try {
        const visit = await dispatch(
          startVisitThunk({ farmerId: entry.farmer.id, fieldId: entry.field.id }),
        ).unwrap();
        navigation.navigate('AssessorVisit', { visitId: visit.id });
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? 'Could not start the visit.';
        showToast(msg, { type: 'error' });
      } finally {
        setStartingFieldId(null);
      }
    },
    [activeVisit, dispatch, navigation],
  );

  const renderRow = (entry: AssessorFieldEntry) => {
    const liveHere = !!activeVisit && activeVisit.fieldId === entry.field.id;
    const onField = liveHere && activeVisit?.status === 'arrived';
    return (
      <AssessorFieldCard
        key={entry.field.id}
        entry={entry}
        phase={liveHere ? (onField ? 'arrived' : 'en_route') : null}
        starting={startingFieldId === entry.field.id}
        onOpen={() => openField(entry)}
        onStartVisit={() => onStartVisit(entry)}
      />
    );
  };

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title={farmName ?? 'Farm'} onBack={() => navigation.goBack()} />
      {error && !overview ? (
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load fields</AppText>
          <AppText style={styles.muted}>{error}</AppText>
          <Button title="Retry" onPress={onRefresh} fullWidth={false} style={styles.retry} />
        </View>
      ) : !overview ? (
        <View style={styles.body}>
          <AppShimmerSection titleWidth="40%">
            <AppShimmerList
              count={5}
              spacing={0}
              renderItem={() => (
                <View style={styles.card}>
                  <View style={styles.skHead}>
                    <AppShimmer
                      width={moderateScale(40)}
                      height={moderateScale(40)}
                      radius={borderRadius.lg}
                    />
                    <View style={styles.skHeadTexts}>
                      <AppShimmer width="60%" />
                      <AppShimmer width="45%" />
                    </View>
                    <AppShimmerCircle size={moderateScale(22)} />
                  </View>
                  <View style={styles.skChips}>
                    <AppShimmerChip />
                    <AppShimmerChip />
                  </View>
                  <AppShimmer width="100%" height={moderateScale(38)} radius={borderRadius.lg} />
                  <AppShimmer width="100%" height={moderateScale(6)} radius={borderRadius.full} />
                  <AppShimmer width="100%" height={moderateScale(36)} radius={borderRadius.lg} />
                </View>
              )}
            />
          </AppShimmerSection>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
          }>
          <SectionHeader title={`Fields (${items.length})`} />
          {items.length > 0 ? (
            items.map(renderRow)
          ) : (
            <EmptyState icon="sprout-outline" title="No fields" message="This farm has no fields assigned to you yet." />
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default AssessorFarmDetailScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  body: { padding: spacing[4], paddingBottom: spacing[10], flexGrow: 1 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    marginBottom: spacing[3],
    gap: spacing[3],
    ...shadows.sm,
  },
  skHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  skHeadTexts: { flex: 1, gap: spacing[1.5] },
  skChips: { flexDirection: 'row', gap: spacing[2] },
  muted: { ...presets.bodySM, color: COLORS.gray600, flexShrink: 1 },
  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4] },
  retry: { marginTop: spacing[4], minWidth: moderateScale(160) },
});
