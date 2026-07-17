import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  View,
  type LayoutChangeEvent,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, AppTextInput, Button } from '../../components';
import { COLORS, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { EmptyState, FarmCard, FARM_CARD_TOTAL_HEIGHT } from '../../components/farms';
import { AppShimmerList, FarmCardShimmer } from '../../components/Shimmer';
import LocationPicker from '../../components/location/LocationPicker';
import { showToast } from '../../services/toastService';
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
  selectFarmsLoading,
  selectFarmsRefreshing,
} from '../../redux/slices/farmSlice';

const HEADER_ACTIONS = ['notification'] as const;

type FarmsView = 'farms' | 'map';

type SortKey = 'default' | 'name_asc' | 'name_desc';
const SORT_ORDER: SortKey[] = ['default', 'name_asc', 'name_desc'];
const SORT_LABEL: Record<SortKey, string> = {
  default: 'Default',
  name_asc: 'Name A-Z',
  name_desc: 'Name Z-A',
};

const TABS: { key: FarmsView; label: string }[] = [
  { key: 'farms', label: 'Farms' },
  { key: 'map', label: 'Map' },
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
  const refreshing = useAppSelector(selectFarmsRefreshing);
  const error = useAppSelector(selectFarmsError);

  const [view, setView] = useState<FarmsView>('farms');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('default');
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const indicatorProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (farms.length === 0) {
      dispatch(fetchFarmsThunk());
    }
  }, [dispatch, farms.length]);

  useEffect(() => {
    const missing = farms
      .filter(farm => fieldCounts[farm.id] === undefined)
      .map(farm => farm.id);
    if (missing.length > 0) {
      dispatch(fetchFarmFieldCountsThunk({ farmIds: missing }));
    }
  }, [dispatch, farms, fieldCounts]);

  const onRefresh = useCallback(() => {
    dispatch(refreshFarmsThunk());
    if (farms.length > 0) {
      dispatch(
        fetchFarmFieldCountsThunk({ farmIds: farms.map(farm => farm.id), overwrite: true }),
      );
    }
  }, [dispatch, farms]);

  const goToFarm = useCallback(
    (farmId: string) => navigation.navigate('FarmDetails', { farmId }),
    [navigation],
  );

  const goToAddFarm = useCallback(() => navigation.navigate('AddFarm'), [navigation]);

  const cycleSort = useCallback(
    () => setSort(s => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]),
    [],
  );
  const clearQuery = useCallback(() => setQuery(''), []);

  const visibleFarms = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? farms.filter(farm => farm.name.toLowerCase().includes(q)) : farms;
    if (sort === 'default') {
      return filtered;
    }
    return [...filtered].sort((a, b) =>
      sort === 'name_asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    );
  }, [farms, query, sort]);

  const renderItem = useCallback<ListRenderItem<Farm>>(
    ({ item }) => (
      <FarmCard farm={item} onPress={goToFarm} fieldCount={fieldCounts[item.id]} />
    ),
    [goToFarm, fieldCounts],
  );

  const keyExtractor = useCallback((item: Farm) => item.id, []);

  const handleViewChange = useCallback((nextView: FarmsView) => {
    setView(currentView => (currentView === nextView ? currentView : nextView));
  }, []);

  const handleTabBarLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setTabBarWidth(currentWidth => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<Farm> | null | undefined, index: number) => ({
      length: FARM_CARD_TOTAL_HEIGHT,
      offset: FARM_CARD_TOTAL_HEIGHT * index,
      index,
    }),
    [],
  );

  const listContentStyle = useMemo(
    () => [styles.listContent, { paddingBottom: insets.bottom + scale(140) }],
    [insets.bottom],
  );
  const floatingStyle = useMemo(
    () => [styles.floating, { bottom: insets.bottom + scale(22) }],
    [insets.bottom],
  );

  const isFarms = view === 'farms';
  const indicatorWidth = tabBarWidth / TABS.length;

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

  const indicatorTranslateX = useMemo(
    () =>
      indicatorProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, indicatorWidth],
      }),
    [indicatorProgress, indicatorWidth],
  );

  const indicatorStyle = useMemo(
    () => [
      styles.tabIndicator,
      {
        width: indicatorWidth,
        transform: [{ translateX: indicatorTranslateX }],
      },
    ],
    [indicatorTranslateX, indicatorWidth],
  );

  const isInitialLoading = loading && farms.length === 0;
  const hasError = !loading && !refreshing && error !== null && farms.length === 0;

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
            {error ?? 'Something went wrong. Please try again.'}
          </AppText>
          <Button
            title="Retry"
            onPress={() => dispatch(fetchFarmsThunk())}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState
              icon="magnify"
              title="No matching farms"
              message={`No farms match "${query.trim()}". Try a different name.`}
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
      <View style={styles.searchBox}>
        <AppIcon name="magnify" size={moderateScale(18)} color={COLORS.gray500} />
        <AppTextInput
          style={styles.searchInput}
          placeholder="Search farms by name"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={clearQuery}
            hitSlop={TAB_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Clear search">
            <AppIcon name="close-circle" size={moderateScale(18)} color={COLORS.gray500} />
          </Pressable>
        ) : null}
      </View>
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
        title="Farms & Fields"
        showDrawer
        rightActions={[...HEADER_ACTIONS]}
      />

      <View style={styles.tabBar} onLayout={handleTabBarLayout}>
        <View style={styles.tabRow}>
          {TABS.map((tab, index) => {
            const active = tab.key === view;
            const distance = Animated.subtract(indicatorProgress, index);
            const activeOpacity = distance.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [0, 1, 0],
              extrapolate: 'clamp',
            });
            const inactiveOpacity = distance.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [1, 0, 1],
              extrapolate: 'clamp',
            });

            return (
              <TabButton
                key={tab.key}
                label={tab.label}
                isActive={active}
                inactiveOpacity={inactiveOpacity}
                activeOpacity={activeOpacity}
                onPress={() => handleViewChange(tab.key)}
              />
            );
          })}
        </View>
        <View style={styles.tabDivider} />
        <Animated.View pointerEvents="none" style={indicatorStyle} />
      </View>

      {isFarms ? (
        <View style={styles.farmsWrap}>
          {farms.length > 0 ? renderControls() : null}
          {renderFarmsContent()}
        </View>
      ) : (
        <LocationPicker
          onConfirm={loc =>
            showToast(
              `Selected: ${loc.address || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`}`,
              { type: 'success' },
            )
          }
        />
      )}

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
