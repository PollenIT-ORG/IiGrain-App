import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import {
  FadeSlideIn,
  FarmerEmptyState,
  FarmerLoader,
  FarmSelectorSheet,
  NextAssessmentCard,
  PerformanceSummaryCard,
  RecentActivityCard,
  RegenHealthCard,
} from '../../components/home';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import {
  fetchDashboardFarmsThunk,
  fetchFarmDashboardThunk,
  selectDashboardError,
  selectDashboardFarms,
  selectDashboardFarmsError,
  selectDashboardFarmsLoading,
  selectDashboardLoading,
  selectFarmDashboard,
  selectSelectedDashboardFarm,
  selectSelectedFarmId,
  setSelectedFarmId,
} from '../../redux/slices/dashboardSlice';
import { selectIncomingVisit } from '../../redux/slices/visitSlice';
import { useFarmerVisitWatch } from '../../hooks/useFarmerVisitWatch';
import type { AppStackParamList, AppTabParamList } from '../../navigation/navigationTypes';
import {
  regenStatusLabel,
  toActivityItems,
  toHealthMetrics,
  toSummaryRows,
  toTrendDelta,
  toUpcomingAssessment,
  toUpcomingPrograms,
} from './dashboardPresenters';
import { styles } from './HomeScreenStyle';
import { tokenStorage } from '../../services/tokenStorage';

const HomeScreen: React.FC = () => {
  const navigation =
    useNavigation<
      CompositeNavigationProp<
        BottomTabNavigationProp<AppTabParamList>,
        NativeStackNavigationProp<AppStackParamList>
      >
    >();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const firstName = (user?.fullName ?? '').trim().split(' ')[0] || 'there';

  const farms = useAppSelector(selectDashboardFarms);
  const selectedFarmId = useAppSelector(selectSelectedFarmId);
  const selectedFarm = useAppSelector(selectSelectedDashboardFarm);
  const farmsLoading = useAppSelector(selectDashboardFarmsLoading);
  const farmsError = useAppSelector(selectDashboardFarmsError);
  const dashboard = useAppSelector(selectFarmDashboard);
  const dashboardLoading = useAppSelector(selectDashboardLoading);
  const dashboardError = useAppSelector(selectDashboardError);

  useFarmerVisitWatch();
  const incomingVisit = useAppSelector(selectIncomingVisit);

  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    dispatch(fetchDashboardFarmsThunk());
  }, [dispatch]);

  useEffect(() => {
    if (selectedFarmId) {
      dispatch(fetchFarmDashboardThunk(selectedFarmId));
    }
  }, [dispatch, selectedFarmId]);

  useEffect(() => {
    (async () => {
      const [accessToken, refreshToken] = await Promise.all([
        tokenStorage.get(),
        tokenStorage.getRefresh(),
      ]);
      console.log('ACCESS TOKEN =>', accessToken);
      console.log('REFRESH TOKEN =>', refreshToken);
    })();
  }, []);

  const goAssessment = useCallback(() => navigation.navigate('Assessment'), [navigation]);
  const goEnroll = useCallback(() => navigation.navigate('EnrollNow'), [navigation]);
  const goFarms = useCallback(() => navigation.navigate('Farms'), [navigation]);
  const goRecommendations = useCallback(() => {
    // TODO: point this at the Recommendations screen once it exists.
  }, []);
  const goReports = useCallback(
    () => navigation.navigate('Reports', { farmId: selectedFarmId ?? undefined }),
    [navigation, selectedFarmId],
  );
  const goVisitTracking = useCallback(
    () =>
      navigation.navigate(
        'FarmerVisitTracking',
        incomingVisit ? { visitId: incomingVisit.id } : undefined,
      ),
    [navigation, incomingVisit],
  );

  const onRefresh = useCallback(() => {
    dispatch(fetchDashboardFarmsThunk());
    if (selectedFarmId) {
      dispatch(fetchFarmDashboardThunk(selectedFarmId));
    }
  }, [dispatch, selectedFarmId]);

  const openSheet = useCallback(() => setSheetVisible(true), []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);
  const handleSelectFarm = useCallback(
    (id: string) => {
      dispatch(setSelectedFarmId(id));
      setSheetVisible(false);
    },
    [dispatch],
  );

  const farmLabel =
    selectedFarm?.name ??
    dashboard?.farm.name ??
    (farmsLoading ? 'Loading…' : farms.length === 0 ? 'No farms yet' : 'Select a farm');

  const noFarms = !farmsLoading && !farmsError && farms.length === 0;
  const showFirstError =
    !dashboard && !noFarms && !dashboardLoading && Boolean(dashboardError || farmsError);
  const showFirstLoading = !dashboard && !noFarms && !showFirstError;

  const metrics = dashboard ? toHealthMetrics(dashboard.categories) : [];
  const trend = dashboard ? toTrendDelta(dashboard.trendVsLastYear) : { positive: true };
  const upcomingAssessment = dashboard ? toUpcomingAssessment(dashboard.upcoming) : null;
  const upcomingPrograms = dashboard ? toUpcomingPrograms(dashboard.upcoming) : [];
  const hasUpcoming = Boolean(upcomingAssessment) || upcomingPrograms.length > 0;
  const activityItems = dashboard ? toActivityItems(dashboard.recentActivity) : [];
  const summaryRows = dashboard ? toSummaryRows(dashboard.summary) : [];

  console.log("metrics - trend  - next  -  activityItems  - summaryRows" , "metrics  --------  " ,  metrics ,  "trend   -----   ---- - ",  trend  , "next ------- -- -- - ---",

      "activityItems-- -- -- - ---- --- -- -", activityItems  , "summaryRows   ----------------   ", summaryRows,
    "token - - - - " , tokenStorage.peek(),
    )

  const visitBanner = incomingVisit ? (
    <TouchableOpacity
      style={styles.visitBanner}
      activeOpacity={0.9}
      onPress={goVisitTracking}
      accessibilityRole="button"
      accessibilityLabel="Track your assessor">
      <View style={styles.visitBannerIcon}>
        <AppIcon name="map-marker-account" size={moderateScale(22)} color={COLORS.white} />
      </View>
      <View style={styles.visitBannerTexts}>
        <AppText style={styles.visitBannerTitle} numberOfLines={1}>
          {incomingVisit.status === 'arrived' ? 'Your assessor has arrived' : 'Assessor on the way'}
        </AppText>
        <AppText style={styles.visitBannerSub} numberOfLines={1}>
          {incomingVisit.assessorName} · Tap to track live
        </AppText>
      </View>
      <View style={styles.visitBannerCta}>
        <AppText style={styles.visitBannerCtaText}>Track</AppText>
        <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(16)} color={COLORS.primary} />
      </View>
    </TouchableOpacity>
  ) : null;

  if (showFirstLoading) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="logo" showDrawer rightActions={['notification']} bgColor />
        {visitBanner}
        <FarmerLoader />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <AppHeader variant="logo" showDrawer rightActions={['notification']} bgColor />
      {visitBanner}

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={!!dashboard && dashboardLoading}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        <FadeSlideIn>
          <View style={styles.morningRowContainer}>
            <AppText style={styles.greeting} numberOfLines={1}>
              Good morning, {firstName}!
            </AppText>

            <TouchableOpacity
              style={styles.recommendationsButton}
              activeOpacity={0.85}
              onPress={goRecommendations}
              accessibilityRole="button"
              accessibilityLabel="Recommendations">
              <View style={styles.recommendationsIcon}>
                <AppIcon name={ICONS.CHECK} size={moderateScale(12)} color={COLORS.white} />
              </View>
              <AppText style={styles.recommendationsText} numberOfLines={1}>
                Recommendations
              </AppText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.farmRow}
            activeOpacity={0.7}
            onPress={openSheet}
            disabled={farms.length === 0}>
            <AppText style={styles.farmName} numberOfLines={1}>
              {farmLabel}
            </AppText>
            <AppIcon name={ICONS.CHEVRON_DOWN} size={moderateScale(18)} color={COLORS.primary} />
          </TouchableOpacity>
        </FadeSlideIn>

        {showFirstLoading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : showFirstError ? (
          <View style={styles.stateWrap}>
            <AppIcon name={ICONS.ERROR} size={moderateScale(44)} color={COLORS.gray500} />
            <AppText style={styles.stateTitle}>Couldn't load dashboard</AppText>
            <AppText style={styles.stateMsg}>{dashboardError || farmsError}</AppText>
            <Button title="Retry" onPress={onRefresh} fullWidth={false} style={styles.retry} />
          </View>
        ) : noFarms ? (
          <FarmerEmptyState
            title="No farms yet"
            message="Add a farm to see its Regen Health Index and assessment progress."
            actionLabel="Go to Farms"
            onAction={goFarms}
          />
        ) : dashboard ? (
          <>
            <FadeSlideIn delay={80} style={styles.section}>
              <RegenHealthCard
                score={dashboard.regenHealthIndex ?? 0}
                status={regenStatusLabel(dashboard.regenHealthIndex)}
                deltaLabel={trend.label}
                deltaPositive={trend.positive}
                metrics={metrics}
                onPress={goReports}
              />
            </FadeSlideIn>

            {hasUpcoming ? (
              <FadeSlideIn delay={200} style={styles.section}>
                <AppText style={styles.sectionTitle}>Upcoming</AppText>
                <View style={styles.upcomingList}>
                  {upcomingAssessment ? (
                    <NextAssessmentCard
                      title={upcomingAssessment.title}
                      dueLabel={upcomingAssessment.dueLabel}
                      actionLabel="Continue"
                      onContinue={goAssessment}
                    />
                  ) : null}
                  {upcomingPrograms.map(p => (
                    <NextAssessmentCard
                      key={p.key}
                      title={p.title}
                      dueLabel={p.dueLabel}
                      actionLabel={p.enrolled ? 'View' : 'Enrol'}
                      onContinue={goEnroll}
                    />
                  ))}
                </View>
              </FadeSlideIn>
            ) : null}

            {activityItems.length > 0 ? (
              <FadeSlideIn delay={260} style={styles.section}>
                <AppText style={styles.sectionTitle}>Recent Activity</AppText>
                <RecentActivityCard items={activityItems} />
              </FadeSlideIn>
            ) : null}

            <FadeSlideIn delay={320} style={styles.section}>
              <AppText style={styles.sectionTitle}>Summary of performance</AppText>
              <PerformanceSummaryCard rows={summaryRows} />
            </FadeSlideIn>
          </>
        ) : null}
      </ScrollView>

      <FarmSelectorSheet
        visible={sheetVisible}
        farms={farms}
        selectedFarmId={selectedFarmId}
        loading={farmsLoading}
        onSelect={handleSelectFarm}
        onClose={closeSheet}
      />
    </View>
  );
};

export default HomeScreen;
