import React, { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppText, Button } from '../../components';
import AppGradient from '../../components/AppGradient/AppGradient';
import { EmptyState } from '../../components/farms';
import {
  AppShimmer,
  AppShimmerCard,
  AppShimmerCircle,
  AppShimmerList,
  SHIMMER_RADIUS,
} from '../../components/Shimmer';
import ModuleRow from '../../components/monitoring/ModuleRow';
import ProgramPicker from '../../components/monitoring/ProgramPicker';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { moduleDef } from '../../config/monitoringModules';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
import {
  fetchFarmProgramsThunk,
  fetchModulesThunk,
  selectChosenProgramId,
  selectFarmPrograms,
  selectFarmProgramsLoaded,
  selectFieldProgram,
  selectModules,
  selectModulesError,
  selectModulesLoading,
  selectProgramsError,
  selectProgramsLoading,
  setMonitoringScope,
} from '../../redux/slices/monitoringSlice';
import type { ModuleKey } from '../../types/monitoring';
import type { AppScreenProps } from '../../navigation/navigationTypes';

export interface MonitoringModulesViewProps {
  farmId: string;
  fieldId: string;
  fieldName: string;
  fieldSubtitle?: string;
  navigation: AppScreenProps<'FieldDetails'>['navigation'];
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const ModulesShimmer: React.FC = () => (
  <AppShimmerList
    count={5}
    renderItem={() => (
      <AppShimmerCard style={styles.shimmerCard}>
        <View style={styles.shimmerRow}>
          <AppShimmerCircle size={scale(46)} />
          <View style={styles.shimmerTexts}>
            <AppShimmer width="55%" height={moderateScale(15)} radius={SHIMMER_RADIUS.sm} />
            <AppShimmer width="75%" height={moderateScale(11)} radius={SHIMMER_RADIUS.sm} />
          </View>
          <AppShimmerCircle size={scale(46)} />
        </View>
        <AppShimmer width="100%" height={scale(6)} radius={SHIMMER_RADIUS.pill} />
      </AppShimmerCard>
    )}
  />
);

const MonitoringModulesView: React.FC<MonitoringModulesViewProps> = ({
  farmId,
  fieldId,
  fieldName,
  fieldSubtitle,
  navigation,
}) => {
  const dispatch = useAppDispatch();

  const allPrograms = useAppSelector(state => selectFarmPrograms(state, farmId));
  const programsLoaded = useAppSelector(state => selectFarmProgramsLoaded(state, farmId));
  const programsLoading = useAppSelector(selectProgramsLoading);
  const programsError = useAppSelector(selectProgramsError);

  const loadPrograms = useCallback(() => {
    dispatch(fetchFarmProgramsThunk({ farmId }));
  }, [dispatch, farmId]);

  useSyncedFetch({
    tags: [Tags.monitoringPrograms(farmId)],
    run: loadPrograms,
    hasData: programsLoaded,
    enabled: !!farmId,
  });

  const programs = useMemo(
    () => allPrograms.filter(p => p.fieldIds.includes(fieldId)),
    [allPrograms, fieldId],
  );

  const chosenId = useAppSelector(state => selectChosenProgramId(state, fieldId));
  const programId = useMemo(() => {
    if (chosenId && programs.some(p => p.programId === chosenId)) {
      return chosenId;
    }
    return programs[0]?.programId ?? null;
  }, [chosenId, programs]);

  const program = programs.find(p => p.programId === programId) ?? null;

  const chooseProgram = useCallback(
    (nextId: string) => {
      dispatch(selectFieldProgram({ fieldId, programId: nextId }));
    },
    [dispatch, fieldId],
  );

  useEffect(() => {
    if (programId) {
      dispatch(setMonitoringScope({ programId, fieldId }));
    }
  }, [dispatch, programId, fieldId]);

  const modules = useAppSelector(selectModules);
  const modulesLoading = useAppSelector(selectModulesLoading);
  const modulesError = useAppSelector(selectModulesError);

  const loadModules = useCallback(() => {
    if (programId) {
      dispatch(fetchModulesThunk({ programId, fieldId }));
    }
  }, [dispatch, programId, fieldId]);

  useSyncedFetch({
    tags: programId ? [Tags.monitoring(programId, fieldId)] : [],
    run: loadModules,
    hasData: modules !== null,
    enabled: !!programId,
  });

  const totals = useMemo(() => {
    if (!modules) {
      return { total: 0, completed: 0, documents: 0, started: 0 };
    }
    return modules.reduce(
      (acc, m) => ({
        total: acc.total + m.total,
        completed: acc.completed + m.completed,
        documents: acc.documents + m.documents,
        started: acc.started + (m.total > 0 ? 1 : 0),
      }),
      { total: 0, completed: 0, documents: 0, started: 0 },
    );
  }, [modules]);

  const percent =
    totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  const openModule = useCallback(
    (module: ModuleKey) => {
      if (!programId) {
        return;
      }
      navigation.navigate('MonitoringModule', {
        programId,
        fieldId,
        module,
        farmId,
        fieldName,
        programName: program?.programName,
      });
    },
    [navigation, programId, fieldId, farmId, fieldName, program],
  );

  const goToEnrol = useCallback(() => {
    navigation.navigate(
      'Shell',
      { screen: 'MainTabs', params: { screen: 'EnrollNow' } },
      { pop: true },
    );
  }, [navigation]);

  if (!programsLoaded && programsLoading) {
    return (
      <View style={styles.wrap}>
        <AppShimmer width="100%" height={scale(58)} radius={SHIMMER_RADIUS.lg} />
        <ModulesShimmer />
      </View>
    );
  }

  if (!programsLoaded && programsError) {
    return (
      <View style={styles.stateBox}>
        <View style={styles.stateIcon}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(28)} color={COLORS.gray600} />
        </View>
        <AppText style={styles.stateText}>{programsError}</AppText>
        <TouchableOpacity onPress={loadPrograms} hitSlop={HIT_SLOP} accessibilityRole="button">
          <AppText style={styles.retryText}>Retry</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  if (programs.length === 0) {
    return (
      <EmptyState
        icon="clipboard-plus-outline"
        title="Not enrolled in a program"
        message="Records are kept per field and per program. Enrol this field in a program to start recording training, soil samples, irrigation and the rest."
        actionLabel="Enrol this field"
        onAction={goToEnrol}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <ProgramPicker
        programs={programs}
        selectedId={programId}
        onSelect={chooseProgram}
      />

      {modules ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHead}>
            <View style={styles.summaryTexts}>
              <AppText style={styles.summaryTitle}>Program Data</AppText>
              <AppText style={styles.summarySub} numberOfLines={1}>
                {fieldSubtitle ? `${fieldName} · ${fieldSubtitle}` : fieldName}
              </AppText>
            </View>

            <View style={styles.percentPill}>
              <AppText style={styles.percentValue}>{percent}%</AppText>
              <AppText style={styles.percentLabel}>done</AppText>
            </View>
          </View>

          <View style={styles.track}>
            {percent > 0 ? (
              <AppGradient
                variant="progress"
                borderRadius={borderRadius.full}
                style={[styles.fill, { width: `${Math.max(percent, 4)}%` }]}
              />
            ) : null}
          </View>

          <View style={styles.summaryStats}>
            <View style={styles.stat}>
              <View style={styles.statIcon}>
                <AppIcon
                  name={ICONS.CHECK}
                  size={moderateScale(14)}
                  color={COLORS.primary}
                />
              </View>
              <AppText style={styles.statValue}>{totals.completed}</AppText>
              <AppText style={styles.statLabel}>Completed</AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <View style={styles.statIcon}>
                <AppIcon
                  name="clipboard-text-outline"
                  size={moderateScale(14)}
                  color={COLORS.primary}
                />
              </View>
              <AppText style={styles.statValue}>{totals.total}</AppText>
              <AppText style={styles.statLabel}>Records</AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <View style={styles.statIcon}>
                <AppIcon
                  name={ICONS.EVIDENCE}
                  size={moderateScale(14)}
                  color={COLORS.primary}
                />
              </View>
              <AppText style={styles.statValue}>{totals.documents}</AppText>
              <AppText style={styles.statLabel}>Files</AppText>
            </View>
          </View>
        </View>
      ) : null}

      {!modules && modulesLoading ? (
        <ModulesShimmer />
      ) : !modules && modulesError ? (
        <View style={styles.stateBox}>
          <View style={styles.stateIcon}>
            <AppIcon name={ICONS.ERROR} size={moderateScale(28)} color={COLORS.gray600} />
          </View>
          <AppText style={styles.stateText}>{modulesError}</AppText>
          <Button
            title="Retry"
            variant="outline"
            fullWidth={false}
            onPress={loadModules}
            style={styles.retryButton}
          />
        </View>
      ) : modules ? (
        <>
          <View style={styles.sectionHead}>
            <AppText style={styles.sectionTitle}>MODULES</AppText>
            <View style={styles.sectionChip}>
              <AppText style={styles.sectionChipText}>
                {totals.started} of {modules.length} started
              </AppText>
            </View>
          </View>

          <View style={styles.list}>
            {modules.map(summary => (
              <ModuleRow
                key={summary.module}
                def={moduleDef(summary.module)}
                summary={summary}
                onPress={() => openModule(summary.module)}
              />
            ))}
          </View>
        </>
      ) : null}

      {modulesLoading && modules ? (
        <View style={styles.refreshRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <AppText style={styles.refreshText}>Refreshing…</AppText>
        </View>
      ) : null}
    </View>
  );
};

export default MonitoringModulesView;

const styles = StyleSheet.create({
  wrap: {
    gap: spacing[4],
  },
  list: {
    gap: spacing[3],
  },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.sm,
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  summaryTexts: {
    flex: 1,
    gap: scale(2),
  },
  summaryTitle: {
    ...presets.headingMD,
    color: COLORS.gray900,
  },
  summarySub: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  percentPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.lightPrimary,
  },
  percentValue: {
    ...presets.headingSM,
    color: COLORS.primary,
  },
  percentLabel: {
    ...presets.labelSM,
    fontSize: moderateScale(10),
    color: COLORS.primary,
  },

  track: {
    height: scale(8),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray200,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },

  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightPrimaryBg,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: scale(3),
  },
  statIcon: {
    width: scale(26),
    height: scale(26),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  statValue: {
    ...presets.headingMD,
    color: COLORS.gray900,
  },
  statLabel: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: addAlpha(COLORS.primary, 0.2),
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    marginBottom: -spacing[1],
  },
  sectionTitle: {
    ...presets.labelSM,
    fontSize: moderateScale(11),
    letterSpacing: 1,
    color: COLORS.gray600,
  },
  sectionChip: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray100,
  },
  sectionChipText: {
    ...presets.labelSM,
    fontSize: moderateScale(11),
    color: COLORS.gray700,
  },

  stateBox: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[10],
  },
  stateIcon: {
    width: scale(56),
    height: scale(56),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  stateText: {
    ...presets.bodySM,
    color: COLORS.gray700,
    textAlign: 'center',
  },
  retryText: {
    ...presets.labelMD,
    color: COLORS.primary,
  },
  retryButton: {
    minWidth: scale(140),
  },

  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  refreshText: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },

  shimmerCard: {
    gap: spacing[3],
  },
  shimmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  shimmerTexts: {
    flex: 1,
    gap: spacing[2],
  },
});
