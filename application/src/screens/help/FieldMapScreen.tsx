/**
 * FieldMapScreen — every farm the user owns, on one map.
 *
 * WHY THIS FILE IS SHORT
 * ----------------------
 * All of the map behaviour — search, base-map switching, framing, selection,
 * the detail card, the empty state — lives in `MapExplorer` (src/maps). It was
 * written here first, for farms, and then extracted the moment it was clear the
 * same interaction is needed for fields, assessors and visits.
 *
 * What is left in this screen is the ONLY part that is genuinely about farms:
 *
 *   1. WHERE THE DATA COMES FROM — the shared farm slice.
 *   2. HOW A FARM BECOMES A PIN — `farmToEntity`.
 *   3. WHAT TAPPING THE ACTION DOES — navigate to FarmDetails.
 *
 * That is the shape every future map screen should have. If you are about to
 * put map logic back in a screen, add a prop to `MapExplorer` instead.
 *
 * DATA SOURCE
 * Reads the shared farm slice rather than calling the API directly, so it
 * reuses whatever FarmsScreen or the dashboard already loaded. It only
 * dispatches a fetch when the slice is genuinely empty — an unguarded fetch
 * here would fight the other screens over the same single-slot cache.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { ICONS } from '../../components/AppIcon';
import { AppHeader } from '../../components';
import { COLORS } from '../../constants';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { fetchFarmsThunk, selectFarms, selectFarmsLoading } from '../../redux/slices/farmSlice';
import { MapExplorer, isValidLatLng, type MapEntity } from '../../maps';
import type { AppStackParamList } from '../../navigation/navigationTypes';
import type { Farm } from '../../types/farm';
import { styles } from './FieldMapScreenStyle';

/**
 * Marker colours by farm status, so the map carries the same signal as the
 * farm list does.
 */
const STATUS_PIN_COLOR: Record<Farm['status'], string> = {
  active: COLORS.primary,
  pending: COLORS.warning,
  inactive: COLORS.gray500,
};

/**
 * The adapter: one farm → one pin.
 *
 * This is the entire domain-specific surface of the screen. A fields map would
 * write `fieldToEntity` and change nothing else.
 */
const farmToEntity = (farm: Farm): MapEntity<Farm> => ({
  id: farm.id,
  // Guarded by the `isValidLatLng` filter at the call site.
  coordinate: {
    latitude: farm.latitude as number,
    longitude: farm.longitude as number,
  },
  title: farm.name,
  subtitle: farm.location,
  meta: `${farm.areaAcres} acres · ${farm.fieldsCount} ${
    farm.fieldsCount === 1 ? 'field' : 'fields'
  }`,
  pinColor: STATUS_PIN_COLOR[farm.status],
  // Owner and soil type are not shown on the pin, but a farmer searching
  // "black soil" or a co-owner's name should still find the farm.
  searchText: `${farm.ownerName ?? ''} ${farm.soilType ?? ''}`,
  data: farm,
});

const FieldMapScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'FieldMap'>>();
  const focusFarmId = route.params?.focusFarmId;

  const dispatch = useAppDispatch();
  const farms = useAppSelector(selectFarms);
  const loading = useAppSelector(selectFarmsLoading);

  // Only fetch when the shared slice has nothing — otherwise this screen would
  // re-request a list that FarmsScreen already owns.
  useEffect(() => {
    if (farms.length === 0 && !loading) {
      dispatch(fetchFarmsThunk({ page: 1 }));
    }
    // Mount-only on purpose: re-running on `farms` would re-fetch forever when
    // the account genuinely has no farms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entities = useMemo<MapEntity<Farm>[]>(
    // Farms without coordinates are dropped here rather than rendered at (0,0):
    // a marker in the Atlantic reads as data corruption.
    () => farms.filter(farm => isValidLatLng(farm)).map(farmToEntity),
    [farms],
  );

  const openFarm = useCallback(
    (entity: MapEntity<Farm>) => {
      navigation.navigate('FarmDetails', { farmId: entity.id });
    },
    [navigation],
  );

  const goToAddFarm = useCallback(() => {
    navigation.navigate('AddFarm');
  }, [navigation]);

  const formatCount = useCallback(
    (count: number) => `${count} ${count === 1 ? 'farm' : 'farms'} mapped`,
    [],
  );

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Field Map" />

      <MapExplorer<Farm>
        entities={entities}
        loading={loading}
        focusEntityId={focusFarmId}
        searchPlaceholder="Search your farms or a place…"
        searchGroupLabel="Your farms"
        formatCountLabel={formatCount}
        actionLabel="View farm"
        onAction={openFarm}
        emptyIcon={ICONS.MAP_MARKER}
        emptyTitle="No mapped farms yet"
        emptyMessage={
          farms.length > 0
            ? 'None of your farms have a location saved. Open a farm and add its location to see it here.'
            : 'Add a farm with a location to see it on the map.'
        }
        emptyActionLabel="Add farm"
        onEmptyAction={goToAddFarm}
      />
    </View>
  );
};

export default FieldMapScreen;
