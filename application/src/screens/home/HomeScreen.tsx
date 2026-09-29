import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import {
  useNavigation,
  type CompositeNavigationProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import StaleDataNote from '../../components/StaleDataNote';
import {
  FadeSlideIn,
  FarmerEmptyState,
  FarmerLoader,
  NextAssessmentCard,
  PerformanceSummaryCard,
  ProgramSelectorCard,
  ProgramSelectorSheet,
  RecentActivityCard,
  RegenHealthCard,
} from '../../components/home';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import {
  fetchDashboardProgramsThunk,
  fetchProgramDashboardThunk,
  selectDashboardError,
  selectDashboardPrograms,
  selectDashboardDefaultProgramId,
  selectDashboardProgramsError,
  selectDashboardProgramsHasMore,
  selectDashboardProgramsLoading,
  selectDashboardProgramsLoadingMore,
  selectDashboardProgramsLoaded,
  selectDashboardProgramsPage,
  selectDashboardProgramsTotal,
  selectDashboardLoading,
  selectDashboardCapturedAt,
  selectProgramDashboard,
  selectSelectedDashboardProgram,
  selectSelectedProgramId,
  setSelectedProgramId,
} from '../../redux/slices/dashboardSlice';
import { selectIncomingVisit } from '../../redux/slices/visitSlice';
import { useOnboardingGate } from '../onboarding/useOnboardingGate';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
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

const DASHBOARD_LIST_TTL_MS = 60_000;

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

  useOnboardingGate();

  const programs = useAppSelector(selectDashboardPrograms);
  const programsLoaded = useAppSelector(selectDashboardProgramsLoaded);
  const selectedProgramId = useAppSelector(selectSelectedProgramId);
  const selectedProgram = useAppSelector(selectSelectedDashboardProgram);
  const programsLoading = useAppSelector(selectDashboardProgramsLoading);
  const programsLoadingMore = useAppSelector(selectDashboardProgramsLoadingMore);
  const programsHasMore = useAppSelector(selectDashboardProgramsHasMore);
  const programsPage = useAppSelector(selectDashboardProgramsPage);
  const programsTotal = useAppSelector(selectDashboardProgramsTotal);
  const programsError = useAppSelector(selectDashboardProgramsError);
  const dashboardDefaultProgramId = useAppSelector(selectDashboardDefaultProgramId);
  const dashboard = useAppSelector(selectProgramDashboard);
  const dashboardCapturedAt = useAppSelector(selectDashboardCapturedAt);
  const dashboardLoading = useAppSelector(selectDashboardLoading);
  const dashboardError = useAppSelector(selectDashboardError);

  const incomingVisit = useAppSelector(selectIncomingVisit);

  const [sheetVisible, setSheetVisible] = useState(false);

  useSyncedFetch({
    tags: [Tags.dashboard],
    run: useCallback(() => {
      dispatch(fetchDashboardProgramsThunk());
    }, [dispatch]),
    hasData: programsLoaded,
    ttlMs: DASHBOARD_LIST_TTL_MS,
  });

  const fetchSelectedDashboard = useCallback(() => {
    if (selectedProgramId) {
      dispatch(fetchProgramDashboardThunk({ programId: selectedProgramId }));
    }
  }, [dispatch, selectedProgramId]);

  useEffect(() => {
    fetchSelectedDashboard();
  }, [fetchSelectedDashboard]);

  useSyncedFetch({
    tags: [Tags.dashboard],
    run: fetchSelectedDashboard,
    hasData: !!dashboard,
    enabled: !!selectedProgramId,
  });

  const goAssessment = useCallback(() => navigation.navigate('Assessment'), [navigation]);
  const goEnroll = useCallback(() => navigation.navigate('EnrollNow'), [navigation]);
  const goRecommendations = useCallback(() => {
  }, []);
  const goReports = useCallback(
    () => navigation.navigate('Reports', { programId: selectedProgramId ?? undefined }),
    [navigation, selectedProgramId],
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
    dispatch(fetchDashboardProgramsThunk());
    if (selectedProgramId) {
      dispatch(fetchProgramDashboardThunk({ programId: selectedProgramId }));
    }
  }, [dispatch, selectedProgramId]);

  const loadMorePrograms = useCallback(() => {
    if (programsLoading || programsLoadingMore || !programsHasMore) {
      return;
    }
    dispatch(fetchDashboardProgramsThunk({ page: programsPage + 1 }));
  }, [dispatch, programsLoading, programsLoadingMore, programsHasMore, programsPage]);

  const openSheet = useCallback(() => setSheetVisible(true), []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);
  const handleSelectProgram = useCallback(
    (id: string) => {
      dispatch(setSelectedProgramId(id));
      setSheetVisible(false);
    },
    [dispatch],
  );

  const programLabel =
    selectedProgram?.name ??
    dashboard?.program.name ??
    (programsLoading ? 'Loading…' : programs.length === 0 ? 'No programs yet' : 'Select a program');

  const noPrograms = !programsLoading && !programsError && programs.length === 0;
  const showFirstError =
    !dashboard && !noPrograms && !dashboardLoading && Boolean(dashboardError || programsError);
  const showFirstLoading = !dashboard && !noPrograms && !showFirstError;

  const metrics = dashboard ? toHealthMetrics(dashboard.categories) : [];
  const trend = dashboard ? toTrendDelta(dashboard.trendVsLastYear) : { positive: true };
  const upcomingAssessment = dashboard ? toUpcomingAssessment(dashboard.upcoming) : null;
  const upcomingPrograms = dashboard ? toUpcomingPrograms(dashboard.upcoming) : [];
  const hasUpcoming = Boolean(upcomingAssessment) || upcomingPrograms.length > 0;
  const activityItems = dashboard ? toActivityItems(dashboard.recentActivity) : [];
  const summaryRows = dashboard ? toSummaryRows(dashboard.summary) : [];

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

          <ProgramSelectorCard
            programName={programLabel}
            status={selectedProgram?.status}
            fieldsEnrolled={selectedProgram?.fieldsEnrolled}
            assessmentsCompleted={selectedProgram?.assessmentsCompleted}
            assessmentsPending={selectedProgram?.assessmentsPending}
            programCount={programsTotal}
            loading={programsLoading && programs.length === 0}
            onPress={openSheet}
          />
        </FadeSlideIn>

        {showFirstError ? (
          <View style={styles.stateWrap}>
            <AppIcon name={ICONS.ERROR} size={moderateScale(44)} color={COLORS.gray500} />
            <AppText style={styles.stateTitle}>Couldn't load dashboard</AppText>
            <AppText style={styles.stateMsg}>{dashboardError || programsError}</AppText>
            <Button title="Retry" onPress={onRefresh} fullWidth={false} style={styles.retry} />
          </View>
        ) : noPrograms ? (
          <FarmerEmptyState
            title="No programs yet"
            message="Enroll in a program to see its Regen Health Index and assessment progress."
            actionLabel="Enroll now"
            onAction={goEnroll}
          />
        ) : dashboard ? (
          <>
            {dashboardCapturedAt ? (
              <FadeSlideIn delay={40} style={styles.section}>
                <StaleDataNote capturedAt={dashboardCapturedAt} />
              </FadeSlideIn>
            ) : null}

            <FadeSlideIn delay={80} style={styles.section}>
              <RegenHealthCard
                score={dashboard.regenHealthIndex ?? 0}
                status={dashboard.rating ?? regenStatusLabel(dashboard.regenHealthIndex)}
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
                      actionLabel={p.enrolled ? 'View' : 'Enroll'}
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

      <ProgramSelectorSheet
        visible={sheetVisible}
        programs={programs}
        selectedProgramId={selectedProgramId}
        defaultProgramId={dashboardDefaultProgramId}
        loading={programsLoading}
        loadingMore={programsLoadingMore}
        hasMore={programsHasMore}
        total={programsTotal}
        onLoadMore={loadMorePrograms}
        onSelect={handleSelectProgram}
        onClose={closeSheet}
      />
    </View>
  );
};

export default HomeScreen;
