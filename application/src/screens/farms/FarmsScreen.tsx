import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import {
  AppHeader,
  AppText,
  Button,
  ListFooterLoader,
  SearchBar,
} from '../../components';
import { useDebouncedValue } from '../../hooks';
import { COLORS, LIST_PERF, spacing } from '../../constants';
import { GENERIC_ERROR_MESSAGE } from '../../config/errorMessages';
import { moderateScale, scale } from '../../utils';
import { EmptyState, FarmCard, FARM_CARD_TOTAL_HEIGHT } from '../../components/farms';
import { AppShimmerList, FarmCardShimmer } from '../../components/Shimmer';
import type { Farm } from '../../types/farm';
import type { AppStackParamList } from '../../navigation/navigationTypes';
import { styles } from './FarmsScreenStyle';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchFarmsThunk,
  fetchFarmFieldCountsThunk,
  refreshFarmsThunk,
  selectFarms,
  selectFarmFieldCounts,
  selectFarmsError,
  selectFarmsHasMore,
  selectFarmsLoading,
  selectFarmsLoadingMore,
  selectFarmsMeta,
  selectFarmsSearch,
  selectFarmsRefreshing,
  selectFarmsTotal,
} from '../../redux/slices/farmSlice';

const HEADER_ACTIONS = ['notification'] as const;

type FarmsView = 'farms' | 'map';

type SortKey = 'default' | 'name_asc' | 'name_desc';
const SORT_ORDER: SortKey[] = ['default', 'name_asc', 'name_desc'];
const SORT_LABEL: Record<SortKey, string> = {
  default: 'Default',
  name_asc: 'Name A–Z',
  name_desc: 'Name Z–A',
};

const TABS: { key: FarmsView; label: string }[] = [
  { key: 'farms', label: 'Farms' },
];

type TabButtonProps = {
  label: string;
  isActive: boolean;
  inactiveOpacity: Animated.AnimatedInterpolation<number>;
  activeOpacity: Animated.AnimatedInterpolation<number>;
  onPress: () => void;
};

const TAB_HIT_SLOP = {
  top: spacing[2],
  right: spacing[2],
  bottom: spacing[2],
  left: spacing[2],
} as const;

const TabButton = memo(
  ({
    label,
    isActive,
    inactiveOpacity,
    activeOpacity,
    onPress,
  }: TabButtonProps) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
      hitSlop={TAB_HIT_SLOP}
      style={styles.tabButton}>
      <View style={styles.tabLabelContainer}>
        <Animated.View style={[styles.tabLabelLayer, { opacity: inactiveOpacity }]}>
          <AppText style={styles.tabLabelInactive}>{label}</AppText>
        </Animated.View>
        <Animated.View style={[styles.tabLabelLayer, styles.tabLabelOverlay, { opacity: activeOpacity }]}>
          <AppText style={styles.tabLabelActive}>{label}</AppText>
        </Animated.View>
      </View>
    </Pressable>
  ),
);

TabButton.displayName = 'TabButton';

const FarmsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const farms = useAppSelector(selectFarms);
  const fieldCounts = useAppSelector(selectFarmFieldCounts);
  const loading = useAppSelector(selectFarmsLoading);
  const loadingMore = useAppSelector(selectFarmsLoadingMore);
  const refreshing = useAppSelector(selectFarmsRefreshing);
  const error = useAppSelector(selectFarmsError);
  const meta = useAppSelector(selectFarmsMeta);
  const appliedSearch = useAppSelector(selectFarmsSearch);
  const hasMore = useAppSelector(selectFarmsHasMore);
  const total = useAppSelector(selectFarmsTotal);

  const [view] = useState<FarmsView>('farms');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('default');
  const indicatorProgress = useRef(new Animated.Value(0)).current;

  const search = useDebouncedValue(query.trim());

  useEffect(() => {
    dispatch(fetchFarmsThunk({ page: 1, search }));
  }, [dispatch, search]);

  const handleEndReached = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore) {
      return;
    }
    dispatch(fetchFarmsThunk({ page: (meta?.page ?? 1) + 1, search }));
  }, [dispatch, loading, loadingMore, refreshing, hasMore, meta, search]);

  useEffect(() => {
    const missing = farms
      .filter(farm => fieldCounts[farm.id] === undefined)
      .map(farm => farm.id);
    if (missing.length > 0) {
      dispatch(fetchFarmFieldCountsThunk({ farmIds: missing }));
    }
  }, [dispatch, farms, fieldCounts]);

  const onRefresh = useCallback(() => {
    dispatch(refreshFarmsThunk({ search }));
    if (farms.length > 0) {
      dispatch(
        fetchFarmFieldCountsThunk({ farmIds: farms.map(farm => farm.id), overwrite: true }),
      );
    }
  }, [dispatch, farms, search]);

  const goToFarm = useCallback(
    (farmId: string) => navigation.navigate('FarmDetails', { farmId }),
    [navigation],
  );

  const goToAddFarm = useCallback(() => navigation.navigate('AddFarm'), [navigation]);

  const cycleSort = useCallback(
    () => setSort(s => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]),
    [],
  );

  const visibleFarms = useMemo(() => {
    if (sort === 'default') {
      return farms;
    }
    return [...farms].sort((a, b) =>
      sort === 'name_asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    );
  }, [farms, sort]);

  const renderItem = useCallback<ListRenderItem<Farm>>(
    ({ item }) => (
      <FarmCard farm={item} onPress={goToFarm} fieldCount={fieldCounts[item.id]} />
    ),
    [goToFarm, fieldCounts],
  );

  const keyExtractor = useCallback((item: Farm) => item.id, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<Farm> | null | undefined, index: number) => ({
      length: FARM_CARD_TOTAL_HEIGHT,
      offset: FARM_CARD_TOTAL_HEIGHT * index,
      index,
    }),
    [],
  );

  const listContentStyle = useMemo(
    () => [styles.listContent, { paddingBottom: insets.bottom + scale(160) }],
    [insets.bottom],
  );
  const floatingStyle = useMemo(
    () => [styles.floating, { bottom: insets.bottom +
      scale(Platform.OS === "ios" ? 8 : 24)
    }],
    [insets.bottom],
  );

  const isFarms = view === 'farms';

  useEffect(() => {
    const nextIndex = TABS.findIndex(tab => tab.key === view);
    Animated.spring(indicatorProgress, {
      toValue: nextIndex,
      stiffness: 220,
      damping: 24,
      mass: 0.9,
      overshootClamping: false,
      restDisplacementThreshold: 0.001,
      restSpeedThreshold: 0.001,
      useNativeDriver: true,
    }).start();
  }, [indicatorProgress, view]);

  const searchSettled = appliedSearch === search;
  const awaitingFirstPage = meta === null || !searchSettled;

  const hasError = !loading && !refreshing && error !== null && farms.length === 0;
  const isInitialLoading =
    !hasError && farms.length === 0 && (loading || awaitingFirstPage);
  const isSearching = query.trim().length > 0 || search.length > 0;
  const showControls = farms.length > 0 || isSearching || !searchSettled;

  const renderFarmsContent = () => {
    if (isInitialLoading) {
      return (
        <View style={styles.listContent}>
          <AppShimmerList count={5} ItemComponent={FarmCardShimmer} />
        </View>
      );
    }

    if (hasError) {
      return (
        <View style={styles.stateCenter}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load farms</AppText>
          <AppText style={styles.stateMessage}>
            {error ?? GENERIC_ERROR_MESSAGE}
          </AppText>
          <Button
            title="Retry"
            onPress={() => dispatch(fetchFarmsThunk({ page: 1, search }))}
            fullWidth={false}
            style={styles.retryBtn}
          />
        </View>
      );
    }

    return (
      <FlatList
        style={styles.list}
        data={visibleFarms}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        contentContainerStyle={listContentStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...LIST_PERF}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListFooterComponent={
          <ListFooterLoader
            loading={loadingMore}
            hasMore={hasMore}
            loadedCount={farms.length}
            total={total}
            endLabel="farms"
          />
        }
        ListEmptyComponent={
          search ? (
            <EmptyState
              icon="magnify"
              title="No matching farms"
              message={`No farms match "${search}". Try a different name or location.`}
            />
          ) : (
            <EmptyState
              icon="barn"
              title="No farms yet"
              message="Add your first farm to start managing fields and assessments."
              actionLabel="Add Farm"
              onAction={goToAddFarm}
            />
          )
        }
      />
    );
  };

  const renderControls = () => (
    <View style={styles.controlsRow}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search farms by name or location"
      />
      <Pressable
        onPress={cycleSort}
        style={styles.sortChip}
        accessibilityRole="button"
        accessibilityLabel={`Sort farms: ${SORT_LABEL[sort]}`}>
        <AppIcon name="sort" size={moderateScale(16)} color={COLORS.primary} />
        <AppText style={styles.sortText} numberOfLines={1}>
          {SORT_LABEL[sort]}
        </AppText>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="title"
        title="Farms"
        showDrawer
        rightActions={[...HEADER_ACTIONS]}
      />

  <View style={styles.farmsWrap}>
          {showControls ? renderControls() : null}
          {renderFarmsContent()}
        </View>

      {isFarms && farms.length > 0 ? (
        <View style={floatingStyle} pointerEvents="box-none">
          <Button
            title="Add Farm"
            onPress={goToAddFarm}
            leftIcon={<AppIcon name={ICONS.PLUS} size={moderateScale(20)} color={COLORS.white} />}
          />
        </View>
      ) : null}
    </View>
  );
};

export default FarmsScreen;
