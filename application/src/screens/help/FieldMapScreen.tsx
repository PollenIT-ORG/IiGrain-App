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

const STATUS_PIN_COLOR: Record<Farm['status'], string> = {
  active: COLORS.primary,
  pending: COLORS.warning,
  inactive: COLORS.gray500,
};

const farmToEntity = (farm: Farm): MapEntity<Farm> => ({
  id: farm.id,
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

  useEffect(() => {
    if (farms.length === 0 && !loading) {
      dispatch(fetchFarmsThunk({ page: 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entities = useMemo<MapEntity<Farm>[]>(
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
