import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import {
  useIsFocused,
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import {
  AnimatedTabBar,
  AppHeader,
  AppText,
  Button,
  ListFooterLoader,
  SearchBar,
  TabItem,
} from '../../components';
import { useDebouncedValue } from '../../hooks';
import {
  AppShimmer,
  AppShimmerCard,
  AppShimmerChip,
  AppShimmerText,
} from '../../components/Shimmer';
import { EmptyState } from '../../components/farms';
import AssessmentFieldCard from '../../components/assessment/AssessmentFieldCard';
import EmptyAssessmentState from '../../components/assessment/EmptyAssessmentState';
import { COLORS, borderRadius, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
import {
  fetchMyAssessmentFieldsThunk,
  fetchMyAssessmentHistoryThunk,
  selectAnswerVersion,
  selectAssessmentError,
  selectMyAssessments,
  selectMyFieldsHasMore,
  selectMyFieldsLoading,
  selectMyFieldsLoadingMore,
  selectMyFieldsPage,
  selectMyHistoryCount,
  selectMyHistoryHasMore,
  selectMyHistoryLoading,
  selectMyHistoryLoadingMore,
  selectMyHistoryPage,
  selectMyHistoryRaw,
} from '../../redux/slices/assessmentSlice';
import type { MyAssessmentField } from '../../types/assessment';
import type {
  AppStackParamList,
  AppTabParamList,
} from '../../navigation/navigationTypes';
import { styles } from './AssessmentScreenStyle';

type AssessmentTab = 'myassessment' | 'history';

const TABS: TabItem<AssessmentTab>[] = [
  { key: 'myassessment', label: 'My Assessment' },
  { key: 'history', label: 'History' },
];

/**
 * Ceiling for how stale these lists may get without any signal. Real changes
 * (enrol / unenrol / submit) arrive through cache-tag invalidation, so this only
 * covers a very long session with the tab left open.
 */
const ASSESSMENTS_TTL_MS = 5 * 60 * 1000;

const AssessmentScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppTabParamList, 'Assessment'>>();
  const dispatch = useAppDispatch();

  const myAssessments = useAppSelector(selectMyAssessments);
  const myFieldsLoading = useAppSelector(selectMyFieldsLoading);
  const myFieldsLoadingMore = useAppSelector(selectMyFieldsLoadingMore);
  const myFieldsHasMore = useAppSelector(selectMyFieldsHasMore);
  const myFieldsPage = useAppSelector(selectMyFieldsPage);

  const historyItems = useAppSelector(selectMyHistoryRaw);
  const historyCount = useAppSelector(selectMyHistoryCount);
  const historyLoading = useAppSelector(selectMyHistoryLoading);
  const historyLoadingMore = useAppSelector(selectMyHistoryLoadingMore);
  const historyHasMore = useAppSelector(selectMyHistoryHasMore);
  const historyPage = useAppSelector(selectMyHistoryPage);

  const error = useAppSelector(selectAssessmentError);
  const answerVersion = useAppSelector(selectAnswerVersion);

  const [activeTab, setActiveTab] = useState<AssessmentTab>('myassessment');
  const [fieldsQuery, setFieldsQuery] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const fieldsSearch = useDebouncedValue(fieldsQuery.trim());
  const historySearch = useDebouncedValue(historyQuery.trim());

  const reloadFields = useCallback(() => {
    dispatch(fetchMyAssessmentFieldsThunk({ page: 1, search: fieldsSearch }));
  }, [dispatch, fieldsSearch]);

  const reloadHistory = useCallback(() => {
    dispatch(fetchMyAssessmentHistoryThunk({ page: 1, search: historySearch }));
  }, [dispatch, historySearch]);

  // Initial load + invalidation-driven refresh. Deliberately NOT a focus
  // refetch: opening this tab must not hit the API. These lists only change
  // when the user enrols/unenrols or submits an assessment, and both of those
  // bump the tags below — locally through syncSlice and remotely through the
  // socket `sync` event — so the data refreshes exactly when it is really stale.
  useSyncedFetch({
    tags: [Tags.myAssessments],
    run: reloadFields,
    hasData: myAssessments !== null,
    ttlMs: ASSESSMENTS_TTL_MS,
  });
  // History also feeds the "Completed" chip on the My Assessment tab, so it
  // cannot be deferred until the History tab is actually opened.
  useSyncedFetch({
    tags: [Tags.assessmentHistory],
    run: reloadHistory,
    hasData: historyItems !== null,
    ttlMs: ASSESSMENTS_TTL_MS,
  });

  // Search is user-driven, so it reloads on its own — but only once the
  // debounced term has really changed. Firing on mount too would double-request
  // alongside the initial load above.
  const lastFieldsSearch = useRef(fieldsSearch);
  useEffect(() => {
    if (lastFieldsSearch.current === fieldsSearch) {
      return;
    }
    lastFieldsSearch.current = fieldsSearch;
    reloadFields();
  }, [fieldsSearch, reloadFields]);

  const lastHistorySearch = useRef(historySearch);
  useEffect(() => {
    if (lastHistorySearch.current === historySearch) {
      return;
    }
    lastHistorySearch.current = historySearch;
    reloadHistory();
  }, [historySearch, reloadHistory]);

  const loadMoreFields = useCallback(() => {
    if (myFieldsLoading || myFieldsLoadingMore || !myFieldsHasMore) {
      return;
    }
    dispatch(fetchMyAssessmentFieldsThunk({ page: myFieldsPage + 1, search: fieldsSearch }));
  }, [
    dispatch,
    myFieldsLoading,
    myFieldsLoadingMore,
    myFieldsHasMore,
    myFieldsPage,
    fieldsSearch,
  ]);

  const loadMoreHistory = useCallback(() => {
    if (historyLoading || historyLoadingMore || !historyHasMore) {
      return;
    }
    dispatch(fetchMyAssessmentHistoryThunk({ page: historyPage + 1, search: historySearch }));
  }, [
    dispatch,
    historyLoading,
    historyLoadingMore,
    historyHasMore,
    historyPage,
    historySearch,
  ]);

  // Deep links (and older callers) can still arrive with a field selected — that
  // detail now lives on its own screen, so hand off and clear the params.
  useEffect(() => {
    const { fieldId, programId } = route.params ?? {};
    if (fieldId && programId) {
      navigation.setParams({ fieldId: undefined, programId: undefined });
      navigation.navigate('AssessmentFieldSummary', { programId, fieldId });
    }
  }, [route.params, navigation]);

  // Submitting an assessment deeper in the flow changes both lists. Edge
  // triggered on the version counter and gated on focus, so coming back here
  // after a submit refreshes exactly once — and simply switching tabs, which
  // does not move the counter, costs nothing.
  const lastSyncedAnswerVersion = useRef(answerVersion);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused || answerVersion === lastSyncedAnswerVersion.current) {
      return;
    }
    lastSyncedAnswerVersion.current = answerVersion;
    reloadFields();
    reloadHistory();
  }, [answerVersion, isFocused, reloadFields, reloadHistory]);

  const handleTabChange = useCallback((tab: AssessmentTab) => setActiveTab(tab), []);

  const onSelectField = useCallback(
    (item: MyAssessmentField) =>
      navigation.navigate('AssessmentFieldSummary', {
        programId: item.programId,
        fieldId: item.fieldId,
        fieldName: item.fieldName,
      }),
    [navigation],
  );
  /**
   * Pull-to-refresh state is LOCAL and user-driven on purpose.
   *
   * It used to be `refreshing={myFieldsLoading && !!myAssessments}`, i.e. any
   * background reload switched the RefreshControl on. On Android that draws an
   * overlay spinner and nothing moves, but on iOS a programmatically-refreshing
   * control expands the scroll view's content inset — which is the empty band
   * that appeared under the search bar and pushed the title down. Tying it to a
   * real pull keeps the layout still.
   */
  const [refreshingFields, setRefreshingFields] = useState(false);
  const onRefreshList = useCallback(async () => {
    setRefreshingFields(true);
    try {
      await dispatch(fetchMyAssessmentFieldsThunk({ page: 1, search: fieldsSearch }));
    } finally {
      setRefreshingFields(false);
    }
  }, [dispatch, fieldsSearch]);

  const onOpenHistory = useCallback(
    (item: MyAssessmentField) => {
      navigation.navigate('AssessmentReview', {
        programId: item.programId,
        fieldId: item.fieldId,
        locked: true,
      });
    },
    [navigation],
  );

  const renderCount = (label: string, value: number, color: string) => (
    <View style={styles.countChip}>
      <AppText style={[styles.countValue, { color }]}>{value}</AppText>
      <AppText style={styles.countLabel}>{label}</AppText>
    </View>
  );

  const renderFieldCardSkeleton = (key: number) => (
    <AppShimmerCard key={key} style={skStyles.cardGap}>
      <View style={skStyles.rowGap}>
        <AppShimmer width={scale(40)} height={scale(40)} radius={borderRadius.md} />
        <View style={skStyles.rowBody}>
          <AppShimmerText width="60%" height={moderateScale(14)} />
          <AppShimmerText width="40%" height={moderateScale(11)} />
        </View>
        <AppShimmerChip width={scale(72)} />
      </View>
      <AppShimmer width="100%" height={scale(8)} radius={borderRadius.full} />
      <AppShimmerText width={scale(90)} height={moderateScale(11)} />
    </AppShimmerCard>
  );

  const renderListSkeleton = () => (
    <View style={styles.body}>
      <View style={styles.landingHeader}>
        <AppShimmerText width="55%" height={moderateScale(18)} />
        <AppShimmerText width={scale(56)} height={moderateScale(11)} />
      </View>
      <View style={styles.countsRow}>
        {[0, 1, 2 ,4].map(i => (
          <View key={i} style={styles.countChip}>
            <AppShimmer width={scale(28)} height={moderateScale(20)} />
            <AppShimmerText width="70%" height={moderateScale(10)} />
          </View>
        ))}
      </View>
      {[0, 1, 2 , 3].map(i => renderFieldCardSkeleton(i))}
    </View>
  );

  const renderError = (message: string, onRetry: () => void) => (
    <View style={styles.stateCenter}>
      <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
      <AppText style={styles.stateTitle}>Couldn't load</AppText>
      <AppText style={styles.stateMessage}>{message}</AppText>
      <Button title="Retry" onPress={onRetry} fullWidth={false} style={styles.retryBtn} />
    </View>
  );

  const renderPendingItem = useCallback<ListRenderItem<MyAssessmentField>>(
    ({ item }) => <AssessmentFieldCard item={item} onPress={onSelectField} />,
    [onSelectField],
  );

  const renderHistoryItem = useCallback<ListRenderItem<MyAssessmentField>>(
    ({ item }) => <AssessmentFieldCard item={item} onPress={onOpenHistory} />,
    [onOpenHistory],
  );

  const rowKeyExtractor = useCallback(
    (item: MyAssessmentField) => `${item.programId}:${item.fieldId}`,
    [],
  );

  const renderFieldList = () => {
    if (error && !myAssessments) {
      return renderError(error, onRefreshList);
    }
    const data = myAssessments;
    // The search bar stays mounted while the skeleton shows. Rendering the
    // skeleton on its own dropped the search bar, so everything below it jumped
    // once the real list arrived.
    if (!data) {
      return (
        <View style={styles.listFlex}>
          <View style={styles.searchWrap}>
            <SearchBar
              value={fieldsQuery}
              onChangeText={setFieldsQuery}
              placeholder="Search by field or crop"
            />
          </View>
          {renderListSkeleton()}
        </View>
      );
    }
    return (
      <View style={styles.listFlex}>
        <View style={styles.searchWrap}>
          <SearchBar
            value={fieldsQuery}
            onChangeText={setFieldsQuery}
            placeholder="Search by field or crop"
          />
        </View>
        <FlatList
          data={data.fields}
          renderItem={renderPendingItem}
          keyExtractor={rowKeyExtractor}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMoreFields}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshingFields}
              onRefresh={onRefreshList}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.landingHeader}>
                <AppText style={styles.landingTitle}>
                  {data.title || 'My Assessments'}
                </AppText>
                <AppText style={styles.landingCount}>
                  {data.counts.total} field{data.counts.total === 1 ? '' : 's'}
                </AppText>
              </View>
              <View style={styles.countsRow}>
                {renderCount('In Progress', data.counts.inProgress, COLORS.primary)}
                {renderCount('Completed', historyCount, COLORS.success)}
                {renderCount('Not Started', data.counts.notStarted, COLORS.gray500)}
              </View>
            </View>
          }
          ListFooterComponent={
            <ListFooterLoader
              loading={myFieldsLoadingMore}
              hasMore={myFieldsHasMore}
              loadedCount={data.fields.length}
              total={data.counts.total}
              endLabel="fields"
            />
          }
          ListEmptyComponent={
            fieldsSearch ? (
              <EmptyState
                icon="magnify"
                title="No matching fields"
                message={`No fields match "${fieldsSearch}". Try a different name or crop.`}
              />
            ) : (
              <EmptyState
                icon="clipboard-text-outline"
                title="No fields to assess"
                message="Add a field to your farm to start an assessment."
              />
            )
          }
        />
      </View>
    );
  };

  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const onRefreshHistory = useCallback(async () => {
    setRefreshingHistory(true);
    try {
      await dispatch(fetchMyAssessmentHistoryThunk({ page: 1, search: historySearch }));
    } finally {
      setRefreshingHistory(false);
    }
  }, [dispatch, historySearch]);

  const renderHistory = () => {
    if (!historyItems) {
      if (error) {
        return renderError(error, onRefreshHistory);
      }
      return (
        <View style={styles.listFlex}>
          <View style={styles.searchWrap}>
            <SearchBar
              value={historyQuery}
              onChangeText={setHistoryQuery}
              placeholder="Search by field or crop"
            />
          </View>
          {renderListSkeleton()}
        </View>
      );
    }
    return (
      <View style={styles.listFlex}>
        <View style={styles.searchWrap}>
          <SearchBar
            value={historyQuery}
            onChangeText={setHistoryQuery}
            placeholder="Search by field or crop"
          />
        </View>
        <FlatList
          data={historyItems}
          renderItem={renderHistoryItem}
          keyExtractor={rowKeyExtractor}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMoreHistory}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshingHistory}
              onRefresh={onRefreshHistory}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListFooterComponent={
            <ListFooterLoader
              loading={historyLoadingMore}
              hasMore={historyHasMore}
              loadedCount={historyItems.length}
              total={historyCount}
              endLabel="assessments"
            />
          }
          ListEmptyComponent={
            historySearch ? (
              <EmptyState
                icon="magnify"
                title="No matching assessments"
                message={`No completed assessments match "${historySearch}".`}
              />
            ) : (
              <EmptyAssessmentState
                icon="clipboard-check-outline"
                title="No History Yet"
                message="Completed assessments will appear here once you submit your first evaluation."
              />
            )
          }
        />
      </View>
    );
  };




  
  return (
    <View style={styles.safe}>
      <AppHeader variant="title" title="Assessments" showDrawer rightActions={null} />

      <AnimatedTabBar
        tabs={TABS}
        activeKey={activeTab}
        onTabChange={handleTabChange}
        style={styles.tabBar}
      />

      {activeTab === 'myassessment' ? renderFieldList() : renderHistory()}
    </View>
  );
};

export default AssessmentScreen;

const skStyles = StyleSheet.create({
  cardGap: { gap: spacing[3] },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rowBody: { flex: 1, gap: spacing[1.5] },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
});
