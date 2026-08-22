import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { AppDropdown, AppHeader, AppText, Button } from '../../components';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { FadeSlideIn, FarmerEmptyState } from '../../components/home';
import { AppShimmer, AppShimmerText } from '../../components/Shimmer';
import { RegenTrendChart, ReportScoreBar } from '../../components/reports';
import { COLORS, borderRadius } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { metricColor } from '../home/dashboardPresenters';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchDashboardFarmsThunk,
  fetchFarmDashboardThunk,
  selectDashboardError,
  selectDashboardFarms,
  selectDashboardFarmsError,
  selectDashboardFarmsLoading,
  selectDashboardLoading,
  selectFarmDashboard,
  selectDashboardYear,
  selectSelectedFarmId,
  setSelectedFarmId,
} from '../../redux/slices/dashboardSlice';
import type { AppStackParamList } from '../../navigation/navigationTypes';
import { styles } from './ReportsScreenStyle';

const SKELETON_ROWS = [0, 1, 2, 3, 4];

const ReportsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AppStackParamList, 'Reports'>>();
  const dispatch = useAppDispatch();

  const farms = useAppSelector(selectDashboardFarms);
  const farmsLoading = useAppSelector(selectDashboardFarmsLoading);
  const farmsError = useAppSelector(selectDashboardFarmsError);
  const selectedFarmId = useAppSelector(selectSelectedFarmId);
  const dashboard = useAppSelector(selectFarmDashboard);
  const loading = useAppSelector(selectDashboardLoading);
  const error = useAppSelector(selectDashboardError);
  const selectedYear = useAppSelector(selectDashboardYear);

  const routeFarmId = route.params?.farmId;
  const appliedRouteFarmRef = useRef<string | null>(null);
  useEffect(() => {
    if (routeFarmId && appliedRouteFarmRef.current !== routeFarmId) {
      appliedRouteFarmRef.current = routeFarmId;
      dispatch(setSelectedFarmId(routeFarmId));
    }
  }, [dispatch, routeFarmId]);

  useEffect(() => {
    if (farms.length === 0) {
      dispatch(fetchDashboardFarmsThunk());
    }
  }, [dispatch, farms.length]);

  useEffect(() => {
    if (selectedFarmId) {
      dispatch(fetchFarmDashboardThunk({ farmId: selectedFarmId }));
    }
  }, [dispatch, selectedFarmId]);

  const onRefresh = useCallback(() => {
    if (selectedFarmId) {
      dispatch(
        fetchFarmDashboardThunk({
          farmId: selectedFarmId,
          year: selectedYear ?? undefined,
        }),
      );
    }
  }, [dispatch, selectedFarmId, selectedYear]);

  const handleSelectYear = useCallback(
    (value: string) => {
      const year = Number(value);
      if (!selectedFarmId || !Number.isFinite(year) || year === selectedYear) {
        return;
      }
      dispatch(fetchFarmDashboardThunk({ farmId: selectedFarmId, year }));
    },
    [dispatch, selectedFarmId, selectedYear],
  );

  const handleSelectFarm = useCallback(
    (id: string) => {
      dispatch(setSelectedFarmId(id));
    },
    [dispatch],
  );

  const farmOptions = useMemo(
    () => farms.map(f => ({ value: f.id, label: f.name })),
    [farms],
  );

  const yearOptions = useMemo(() => {
    const years = dashboard?.availableYears?.length
      ? dashboard.availableYears
      : dashboard
        ? [dashboard.year]
        : [];
    return years.map(y => ({ value: String(y), label: String(y) }));
  }, [dashboard]);

  const trendData = useMemo(() => {
    if (dashboard?.trend?.length) {
      return dashboard.trend.map(p => ({ year: p.year, value: p.score }));
    }
    if (dashboard && dashboard.regenHealthIndex !== null) {
      return [{ year: dashboard.year, value: dashboard.regenHealthIndex }];
    }
    return [];
  }, [dashboard]);

  const allCategories = useMemo(
    () => dashboard?.categories ?? [],
    [dashboard?.categories],
  );

  console.log('[Reports] dashboard payload', {
    farmId: selectedFarmId,
    year: dashboard?.year,
    availableYears: dashboard?.availableYears,
    trend: dashboard?.trend,
    regenHealthIndex: dashboard?.regenHealthIndex,
    trendVsLastYear: dashboard?.trendVsLastYear,
    categories: dashboard?.categories?.length,
    loading,
    error,
  });

  const contentKey = `${selectedFarmId ?? ''}:${dashboard?.year ?? ''}`;
  const switchingYear = loading && !!dashboard;

  const noFarms = !farmsLoading && !farmsError && farms.length === 0;
  const showFirstError = !dashboard && !noFarms && !loading && Boolean(error || farmsError);
  const showFirstLoading = !dashboard && !noFarms && !showFirstError;

  const header = (
    <AppHeader variant="back" title="Reports" onBack={() => navigation.goBack()} />
  );

  if (noFarms) {
    return (
      <View style={styles.safe}>
        {header}
        <FarmerEmptyState
          title="No farms yet"
          message="Add a farm and complete an assessment to see your regen report."
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const renderSkeleton = () => (
    <View style={styles.body}>
      <View style={styles.pickerRow}>
        <View style={styles.pickerYear}>
          <AppShimmer width="100%" height={scale(46)} radius={borderRadius.lg} />
        </View>
        <View style={styles.pickerFarm}>
          <AppShimmer width="100%" height={scale(46)} radius={borderRadius.lg} />
        </View>
      </View>

      <View style={[styles.card, styles.section]}>
        <AppShimmerText width="55%" height={moderateScale(15)} />
        <AppShimmer
          width="100%"
          height={scale(180)}
          radius={borderRadius.lg}
          style={styles.skeletonGap}
        />
      </View>

      <View style={[styles.card, styles.section]}>
        <AppShimmerText width="40%" height={moderateScale(15)} />
        <View style={styles.bars}>
          {SKELETON_ROWS.map(i => (
            <View key={i} style={styles.skeletonBarRow}>
              <AppShimmerText width="34%" height={moderateScale(12)} />
              <AppShimmer
                width="46%"
                height={scale(8)}
                radius={borderRadius.full}
              />
              <AppShimmerText width={scale(24)} height={moderateScale(12)} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  if (showFirstLoading) {
    return (
      <View style={styles.safe}>
        {header}
        {renderSkeleton()}
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      {header}

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={!!dashboard && loading}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        <FadeSlideIn style={styles.pickerRow}>
          {yearOptions.length > 0 ? (
            <View style={styles.pickerYear}>
              <AppDropdown
                value={selectedYear !== null ? String(selectedYear) : null}
                options={yearOptions}
                onSelect={handleSelectYear}
                placeholder="Year"
                loading={switchingYear}
              />
            </View>
          ) : null}
          <View style={styles.pickerFarm}>
            <AppDropdown
              value={selectedFarmId}
              options={farmOptions}
              onSelect={handleSelectFarm}
              placeholder="Farm"
              loading={farmsLoading}
            />
          </View>
        </FadeSlideIn>

        {showFirstError ? (
          <View style={styles.stateWrap}>
            <AppIcon name={ICONS.ERROR} size={moderateScale(44)} color={COLORS.gray500} />
            <AppText style={styles.stateTitle}>Couldn't load report</AppText>
            <AppText style={styles.stateMsg}>{error || farmsError}</AppText>
            <Button title="Retry" onPress={onRefresh} fullWidth={false} style={styles.retry} />
          </View>
        ) : dashboard ? (
          <View key={contentKey}>
            <FadeSlideIn delay={60} style={styles.section}>
              <View style={styles.card}>
                <AppText style={styles.cardTitle}>Regen Health Index Trend</AppText>
                {trendData.length > 0 ? (
                  <RegenTrendChart data={trendData} selectedYear={dashboard.year} />
                ) : (
                  <View style={styles.inlineEmpty}>
                    <AppIcon
                      name={ICONS.ASSESSMENT}
                      size={moderateScale(32)}
                      color={COLORS.gray500}
                    />
                    <AppText style={styles.inlineEmptyText}>
                      Submit an assessment to start building your trend.
                    </AppText>
                  </View>
                )}
              </View>
            </FadeSlideIn>

            <FadeSlideIn delay={140} style={styles.section}>
              <View style={styles.card}>
                <AppText style={styles.cardTitle}>Category Scores</AppText>
                {allCategories.length > 0 ? (
                  <View style={styles.bars}>
                    {allCategories.map((c, index) => (
                      <ReportScoreBar
                        key={c.id}
                        label={c.name}
                        value={c.score}
                        color={metricColor(index)}
                        delay={220 + index * 70}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.inlineEmpty}>
                    <AppIcon
                      name={ICONS.ASSESSMENT}
                      size={moderateScale(32)}
                      color={COLORS.gray500}
                    />
                    <AppText style={styles.inlineEmptyText}>
                      Answer your assessment questions to see how each category scores.
                    </AppText>
                  </View>
                )}
              </View>
            </FadeSlideIn>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default ReportsScreen;
