import React, { useCallback, useEffect, useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppStatusBadge, AppText, Button } from '../../components';
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
import {
  fetchAssessorFieldsThunk,
  selectAssessorError,
  selectAssessorFieldsOverview,
  selectAssessorFieldsOverviewLoading,
} from '../../redux/slices/assessorSlice';
import { deriveFarmerFarms } from '../../redux/derive/assessorDerive';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';
import type { AssessorFarmRow } from '../../types/assessor';

const AssessorFarmerDetailScreen: React.FC<AssessorScreenProps<'AssessorFarmerDetail'>> = ({
  route,
  navigation,
}) => {
  const { farmerId, farmerName } = route.params;
  const dispatch = useAppDispatch();
  const overview = useAppSelector(selectAssessorFieldsOverview);
  const loading = useAppSelector(selectAssessorFieldsOverviewLoading);
  const error = useAppSelector(selectAssessorError);

  const farms = useMemo(
    () => (overview ? deriveFarmerFarms(overview, farmerId) : []),
    [overview, farmerId],
  );

  useEffect(() => {
    if (!overview) {
      dispatch(fetchAssessorFieldsThunk());
    }
  }, [dispatch, overview]);

  const onRefresh = useCallback(() => dispatch(fetchAssessorFieldsThunk()), [dispatch]);

  const openFarm = useCallback(
    (farm: AssessorFarmRow) =>
      navigation.navigate('AssessorFarmDetail', { farmId: farm.id, farmName: farm.name }),
    [navigation],
  );

  const renderRow = (farm: AssessorFarmRow) => {
    const allDone = farm.pendingCount === 0 && farm.fieldsCount > 0;
    return (
      <TouchableOpacity key={farm.id} activeOpacity={0.85} style={styles.card} onPress={() => openFarm(farm)}>
        <View style={styles.rowBetween}>
          <View style={styles.nameRow}>
            <View style={styles.iconCircle}>
              <AppIcon name={ICONS.FARM} size={moderateScale(20)} color={COLORS.primary} />
            </View>
            <AppText style={styles.name} numberOfLines={1}>{farm.name}</AppText>
          </View>
          <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(22)} color={COLORS.gray500} />
        </View>
        <View style={styles.metaRow}>
          <AppText style={styles.muted}>
            {farm.fieldsCount} field{farm.fieldsCount === 1 ? '' : 's'} · {farm.doneCount}/{farm.fieldsCount} assessed
          </AppText>
          <AppStatusBadge
            tone={allDone ? 'success' : 'warning'}
            label={allDone ? 'All done' : `${farm.pendingCount} pending`}
            size="sm"
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title={farmerName ?? 'Farmer'} onBack={() => navigation.goBack()} />
      {error && !overview ? (
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load farms</AppText>
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
                    <AppShimmer width="45%" />
                    <AppShimmerChip />
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
          <SectionHeader title={`Farms (${farms.length})`} />
          {farms.length > 0 ? (
            farms.map(renderRow)
          ) : (
            <EmptyState icon="barn" title="No farms" message="This farmer has no farms assigned to you yet." />
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default AssessorFarmerDetailScreen;

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
    gap: spacing[2],
    ...shadows.sm,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5], flexShrink: 1 },
  iconCircle: {
    width: moderateScale(38), height: moderateScale(38), borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimary, alignItems: 'center', justifyContent: 'center',
  },
  name: { ...presets.labelLG, color: COLORS.gray900, flexShrink: 1 },
  muted: { ...presets.bodySM, color: COLORS.gray500, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4] },
  retry: { marginTop: spacing[4], minWidth: moderateScale(160) },
});
