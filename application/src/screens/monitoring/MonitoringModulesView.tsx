import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppProgressBar, AppText, Button, ConfirmationModal } from '../../components';
import {
  AppShimmer,
  AppShimmerCard,
  AppShimmerCircle,
  AppShimmerList,
  SHIMMER_RADIUS,
} from '../../components/Shimmer';
import ModuleRow from '../../components/monitoring/ModuleRow';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { moduleDef, takesFieldPoints } from '../../config/monitoringModules';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
import {
  fetchModulesThunk,
  selectModules,
  selectModulesError,
  selectModulesLoading,
  setMonitoringScope,
} from '../../redux/slices/monitoringSlice';
import type { ModuleKey } from '../../types/monitoring';
import type { AppScreenProps } from '../../navigation/navigationTypes';

export interface MonitoringModulesViewProps {
  farmId: string;
  fieldId: string;
  fieldName: string;
  fieldSubtitle?: string;
  hasBoundary: boolean;
  onDrawBoundary: () => void;
  navigation: AppScreenProps<'FieldDetails'>['navigation'];
}

const LOCK_TITLE = 'Draw your field first';

const LOCK_MESSAGE =
  'Soil samples are saved point by point on your field, so the app needs to know ' +
  'the shape of your field before you can add them. Draw the boundary once and ' +
  'every corner becomes a sampling point, ready for you to fill in.';

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
  hasBoundary,
  onDrawBoundary,
  navigation,
}) => {
  const [lockedModule, setLockedModule] = useState<ModuleKey | null>(null);
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    dispatch(setMonitoringScope({ fieldId }));
  }, [dispatch, fieldId]);

  const modules = useAppSelector(selectModules);
  const modulesLoading = useAppSelector(selectModulesLoading);
  const modulesError = useAppSelector(selectModulesError);

  const loadModules = useCallback(() => {
    dispatch(fetchModulesThunk({ fieldId }));
  }, [dispatch, fieldId]);

  useSyncedFetch({
    tags: [Tags.monitoring(fieldId)],
    run: loadModules,
    hasData: modules !== null,
    enabled: !!fieldId,
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

  const isLocked = useCallback(
    (module: ModuleKey) => !hasBoundary && takesFieldPoints(module),
    [hasBoundary],
  );

  const openModule = useCallback(
    (module: ModuleKey) => {
      if (isLocked(module)) {
        setLockedModule(module);
        return;
      }
      navigation.navigate('MonitoringModule', {
        fieldId,
        module,
        farmId,
        fieldName,
      });
    },
    [isLocked, navigation, fieldId, farmId, fieldName],
  );

  const closeLockNotice = useCallback(() => setLockedModule(null), []);

  const drawBoundaryFromNotice = useCallback(() => {
    setLockedModule(null);
    onDrawBoundary();
  }, [onDrawBoundary]);

  if (!modules) {
    if (modulesError) {
      return (
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
      );
    }
    return (
      <View style={styles.wrap}>
        <AppShimmer width="100%" height={scale(148)} radius={SHIMMER_RADIUS.lg} />
        <ModulesShimmer />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryHead}>
          <View style={styles.summaryTexts}>
            <AppText style={styles.summaryTitle}>Field Monitoring</AppText>
            <AppText style={styles.summarySub} numberOfLines={1}>
              {fieldSubtitle ? `${fieldName} · ${fieldSubtitle}` : fieldName}
            </AppText>
          </View>

          <View style={styles.percentPill}>
            <AppText style={styles.percentValue}>{percent}%</AppText>
            <AppText style={styles.percentLabel}>done</AppText>
          </View>
        </View>

        <AppProgressBar percent={percent} height={scale(8)} />

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
            locked={isLocked(summary.module)}
            onPress={openModule}
          />
        ))}
      </View>

      <ConfirmationModal
        visible={lockedModule !== null}
        icon="vector-polygon"
        title={LOCK_TITLE}
        message={LOCK_MESSAGE}
        confirmLabel="Draw boundary"
        cancelLabel="Not now"
        onConfirm={drawBoundaryFromNotice}
        onCancel={closeLockNotice}
      />

      {modulesLoading ? (
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
