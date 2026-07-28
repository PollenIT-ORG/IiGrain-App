import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppStatusBadge, AppText, Button } from '../../components';
import type { BadgeTone } from '../../types/farm';
import { EmptyState, SectionHeader } from '../../components/farms';
import {
  AppShimmer,
  AppShimmerChip,
  AppShimmerCircle,
  AppShimmerList,
  AppShimmerSection,
} from '../../components/Shimmer';
import { COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing, fonts } from '../../constants';
import { capitalize, moderateScale } from '../../utils';
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
import { deriveFarmFields } from '../../redux/derive/assessorDerive';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';
import type { AssessorFieldEntry } from '../../types/assessor';

const HEALTH: Record<string, { label: string; tone: BadgeTone }> = {
  healthy: { label: 'Healthy', tone: 'success' },
  monitor: { label: 'Monitor', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
};
const healthOf = (status: string): { label: string; tone: BadgeTone } =>
  HEALTH[status] ?? { label: status ? capitalize(status) : '—', tone: 'neutral' };

const statusLine = (a: AssessorFieldEntry['assessment']): { icon: string; color: string; text: string } => {
  if (a.completed) {
    return { icon: 'check-decagram', color: COLORS.success, text: `Assessed by you · ${a.percentage}%` };
  }
  if (a.percentage > 0 || a.answered > 0) {
    return { icon: 'progress-clock', color: COLORS.accent, text: `In progress · ${a.percentage}%` };
  }
  return { icon: 'clipboard-text-outline', color: COLORS.gray500, text: 'Not assessed — tap to assess' };
};

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

  // Shared overview cache: fetch once, then refresh only when the socket says
  // an assignment/assessment changed (or the TTL lapses). See the hook.
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
    const health = healthOf(entry.field.status);
    const line = statusLine(entry.assessment);
    const liveHere = !!activeVisit && activeVisit.fieldId === entry.field.id;
    return (
      <View key={entry.field.id} style={styles.card}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => openField(entry)} style={styles.cardBody}>
          <View style={styles.rowBetween}>
            <View style={styles.nameRow}>
              <View style={styles.iconCircle}>
                <AppIcon name={ICONS.FIELD} size={moderateScale(20)} color={COLORS.primary} />
              </View>
              <AppText style={styles.name} numberOfLines={1}>{entry.field.name}</AppText>
            </View>
            <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(22)} color={COLORS.gray500} />
          </View>

          <View style={styles.metaRow}>
            <View style={styles.cropRow}>
              <AppIcon name={ICONS.CROP} size={moderateScale(15)} color={COLORS.gray600} />
              <AppText style={styles.muted} numberOfLines={1}>{entry.field.crop || '—'}</AppText>
            </View>
            <AppStatusBadge tone={health.tone} label={health.label} size="sm" />
          </View>

          <View style={styles.statusLine}>
            <AppIcon name={line.icon} size={moderateScale(14)} color={line.color} />
            <AppText style={[styles.statusText, { color: line.color }]} numberOfLines={1}>{line.text}</AppText>
          </View>
        </TouchableOpacity>

        <View style={styles.cardFooter}>
          <Button
            title={liveHere ? 'Resume visit' : 'Start visit'}
            onPress={() => onStartVisit(entry)}
            loading={startingFieldId === entry.field.id}
            variant={liveHere ? 'primary' : 'outline'}
            size="sm"
            leftIcon={
              <AppIcon
                name="navigation-variant"
                size={moderateScale(16)}
                color={liveHere ? COLORS.white : COLORS.primary}
              />
            }
            style={styles.visitBtn}
          />
        </View>
      </View>
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
                  <View style={styles.rowBetween}>
                    <View style={styles.nameRow}>
                      <AppShimmer
                        width={moderateScale(38)}
                        height={moderateScale(38)}
                        radius={borderRadius.md}
                      />
                      <AppShimmer width="55%" />
                    </View>
                    <AppShimmerCircle size={moderateScale(22)} />
                  </View>
                  <View style={styles.metaRow}>
                    <AppShimmer width="35%" />
                    <AppShimmerChip />
                  </View>
                  <View style={styles.statusLine}>
                    <AppShimmer width="50%" />
                  </View>
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
    ...shadows.sm,
  },
  cardBody: { gap: spacing[2] },
  cardFooter: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
  },
  visitBtn: { alignSelf: 'stretch' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5], flexShrink: 1 },
  iconCircle: {
    width: moderateScale(38), height: moderateScale(38), borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimary, alignItems: 'center', justifyContent: 'center',
  },
  name: { ...presets.labelLG, color: COLORS.gray900, flexShrink: 1 },
  muted: { ...presets.bodySM, color: COLORS.gray600, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  cropRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5], flexShrink: 1 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  statusText: { ...presets.caption, fontFamily: fonts.semibold, flexShrink: 1 },
  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4] },
  retry: { marginTop: spacing[4], minWidth: moderateScale(160) },
});
