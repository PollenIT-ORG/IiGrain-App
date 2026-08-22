import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import {
  AppHeader,
  AppOverflowMenu,
  AppText,
  Button,
  ConfirmationModal,
} from '../../components';
import type { OverflowMenuItem } from '../../components';
import {
  AreaSummaryCard,
  EmptyState,
  FarmSummaryCard,
  FieldCard,
  QuickStatsCard,
} from '../../components/farms';
import { COLORS, spacing } from '../../constants';
import { GENERIC_ERROR_MESSAGE } from '../../config/errorMessages';
import { formatDate, moderateScale, scale } from '../../utils';
import {
  AppShimmerCard,
  AppShimmerList,
  AppShimmerRow,
  AppShimmerText,
  FieldCardShimmer,
} from '../../components/Shimmer';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import { styles, FAB_METRICS } from './FarmDetailsScreenStyle';
import { showSuccess } from '../../services/toastService';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchFarmDetailThunk,
  refreshFarmDetailThunk,
  selectFarmDetailError,
  selectFarmDetailLoading,
  selectFarmDeleting,
  selectFarmFieldCounts,
  selectFarmResetting,
  selectSelectedFarm,
  resetFarmThunk,
  deleteFarmThunk,
} from '../../redux/slices/farmSlice';
import {
  fetchFarmFieldsThunk,
  refreshFarmFieldsThunk,
  selectFields,
  selectFieldsFarmId,
  selectFieldsLoading,
} from '../../redux/slices/fieldSlice';

type PendingAction = 'reset' | 'delete' | null;

const FAB_SCROLL_THRESHOLD = 12;

const FarmDetailsScreen: React.FC<AppScreenProps<'FarmDetails'>> = ({
  route,
  navigation,
}) => {
  const { farmId } = route.params;
  const dispatch = useAppDispatch();

  const farm = useAppSelector(selectSelectedFarm);
  const loading = useAppSelector(selectFarmDetailLoading);
  const error = useAppSelector(selectFarmDetailError);
  const resetting = useAppSelector(selectFarmResetting);
  const deleting = useAppSelector(selectFarmDeleting);

  const fields = useAppSelector(selectFields);
  const fieldsLoading = useAppSelector(selectFieldsLoading);
  const fieldsFarmId = useAppSelector(selectFieldsFarmId);
  const fieldCounts = useAppSelector(selectFarmFieldCounts);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const deletedRef = useRef(false);

  useEffect(() => {
    if (deletedRef.current) {
      return;
    }
    if (farm?.id !== farmId) {
      dispatch(fetchFarmDetailThunk(farmId));
    }
    if (fieldsFarmId !== farmId) {
      dispatch(fetchFarmFieldsThunk(farmId));
    }
  }, [dispatch, farmId, farm, fieldsFarmId]);

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      dispatch(refreshFarmDetailThunk(farmId));
      dispatch(refreshFarmFieldsThunk(farmId));
    }, [dispatch, farmId]),
  );

  const goToEditFarm = useCallback(
    () => navigation.navigate('AddFarm', { farmId }),
    [navigation, farmId],
  );

  const askReset = useCallback(() => setPendingAction('reset'), []);
  const askDelete = useCallback(() => setPendingAction('delete'), []);
  const dismissDialog = useCallback(() => setPendingAction(null), []);

  const runResetFarm = useCallback(async () => {
    const action = await dispatch(resetFarmThunk(farmId));
    if (resetFarmThunk.fulfilled.match(action)) {
      setPendingAction(null);
      showSuccess('Farm reset');
      dispatch(refreshFarmFieldsThunk(farmId));
      return;
    }
    setPendingAction(null);
  }, [dispatch, farmId]);

  const runDeleteFarm = useCallback(async () => {
    deletedRef.current = true;
    const action = await dispatch(deleteFarmThunk(farmId));
    setPendingAction(null);
    if (deleteFarmThunk.fulfilled.match(action)) {
      showSuccess('Farm deleted');
      navigation.goBack();
    } else {
      deletedRef.current = false;
    }
  }, [dispatch, farmId, navigation]);

  const menuItems = useMemo<OverflowMenuItem[]>(
    () => [
      { key: 'edit', icon: 'pencil-outline', title: 'Edit Farm', onPress: goToEditFarm },
      {
        key: 'reset',
        icon: 'backup-restore',
        title: 'Reset Farm',
        onPress: askReset,
        loading: resetting,
      },
      {
        key: 'delete',
        icon: 'trash-can-outline',
        title: 'Delete Farm',
        onPress: askDelete,
        destructive: true,
        loading: deleting,
      },
    ],
    [goToEditFarm, askReset, askDelete, resetting, deleting],
  );

  const goToField = useCallback(
    (fieldId: string) => navigation.navigate('FieldDetails', { farmId, fieldId }),
    [navigation, farmId],
  );

  const goToAddField = useCallback(
    () => navigation.navigate('AddField', { farmId, farmName: farm?.name }),
    [navigation, farmId, farm?.name],
  );

  const fabAnim = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const fabHidden = useRef(false);

  const setFabVisible = useCallback(
    (visible: boolean) => {
      if (fabHidden.current !== visible) {
        return;
      }
      fabHidden.current = !visible;
      Animated.timing(fabAnim, {
        toValue: visible ? 0 : 1,
        duration: FAB_METRICS.animMs,
        useNativeDriver: true,
      }).start();
    },
    [fabAnim],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      const delta = offset - lastOffset.current;
      if (Math.abs(delta) < FAB_SCROLL_THRESHOLD) {
        return;
      }
      lastOffset.current = offset;
      setFabVisible(delta < 0 || offset <= 0);
    },
    [setFabVisible],
  );

  const fabStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: fabAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, FAB_METRICS.hideOffset],
          }),
        },
        {
          scale: fabAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, FAB_METRICS.hideScale],
          }),
        },
      ],
      opacity: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    }),
    [fabAnim],
  );

  if (loading) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Farm" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <AppShimmerCard>
            <AppShimmerRow showLeading leadingSize={scale(56)} lines={2} />
            <View style={styles.gap} />
            <AppShimmerText count={4} spacing={spacing[3]} lastLineWidth="70%" />
          </AppShimmerCard>
          <View style={styles.gap} />
          <AppShimmerCard>
            <AppShimmerRow showLeading leadingSize={scale(40)} lines={2} />
          </AppShimmerCard>
          <View style={styles.gap} />
          <AppShimmerList count={2} ItemComponent={FieldCardShimmer} />
        </ScrollView>
      </View>
    );
  }

  if (error && !farm) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Farm" onBack={() => navigation.goBack()} />
        <View style={styles.stateCenter}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load farm</AppText>
          <AppText style={styles.stateMessage}>
            {error ?? GENERIC_ERROR_MESSAGE}
          </AppText>
          <Button
            title="Retry"
            onPress={() => dispatch(fetchFarmDetailThunk(farmId))}
            fullWidth={false}
            style={styles.retryBtn}
          />
        </View>
      </View>
    );
  }

  if (!farm) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Farm" onBack={() => navigation.goBack()} />
        <EmptyState
          icon="barn"
          title="Farm not found"
          message="This farm is no longer available."
        />
      </View>
    );
  }

  const farmFields = fieldsFarmId === farmId ? fields : [];
  const liveCount = fieldsFarmId === farmId && !fieldsLoading ? fields.length : undefined;
  const fieldCount = liveCount ?? fieldCounts[farmId] ?? (farm.fieldsCount || undefined);
  const showAreaCard = farm.usedAcres != null && farm.availableAcres != null;

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title={farm.name}
        onBack={() => navigation.goBack()}
        rightActions={null}
        rightComponent={
          <AppOverflowMenu items={menuItems} accessibilityLabel="Farm actions" />
        }
      />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}>
        <FarmSummaryCard farm={farm} fieldsCount={fieldCount} />

        <View style={styles.gap} />
        <QuickStatsCard
          regenScore={farm.regenScore}
          lastUpdatedLabel={formatDate(farm.lastUpdatedISO)}
        />

        {showAreaCard ? (
          <>
            <View style={styles.gap} />
            <AreaSummaryCard
              total={farm.areaAcres}
              used={farm.usedAcres as number}
              available={farm.availableAcres as number}
            />
          </>
        ) : null}

        <View style={styles.sectionGap} />
        <View style={styles.fieldsHeaderRow}>
          <AppText style={styles.fieldsHeaderTitle}>Fields</AppText>
          <AppText style={styles.fieldsCount}>{farmFields.length}</AppText>
          <Button
            title="Add Field"
            variant="outline"
            size="sm"
            fullWidth={false}
            onPress={goToAddField}
            style={styles.fieldsHeaderAction}
            leftIcon={
              <AppIcon
                name={ICONS.PLUS}
                size={moderateScale(16)}
                color={COLORS.primary}
              />
            }
          />
        </View>

        {fieldsLoading && farmFields.length === 0 ? (
          <ActivityIndicator color={COLORS.primary} style={styles.fieldsLoader} />
        ) : farmFields.length > 0 ? (
          farmFields.map(field => (
            <FieldCard key={field.id} field={field} onPress={goToField} />
          ))
        ) : (
          <View style={styles.fieldsEmpty}>
            <AppIcon name={ICONS.FIELD} size={moderateScale(32)} color={COLORS.gray300} />
            <AppText style={styles.fieldsEmptyText}>
              No fields yet. Add your first field to start tracking this farm.
            </AppText>
          </View>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={pendingAction === 'reset'}
        icon="backup-restore"
        title="Reset this farm?"
        message="Resetting clears the farm's recorded details so you can start over. The farm itself stays where it is."
        consequences={['Location, area and soil details', 'Business entity information']}
        retains={['The farm name', 'Its fields', 'Assessments and soil records']}
        confirmLabel="Reset Farm"
        loading={resetting}
        onConfirm={runResetFarm}
        onCancel={dismissDialog}
      />

      <ConfirmationModal
        visible={pendingAction === 'delete'}
        tone="danger"
        icon="trash-can-outline"
        title="Delete this farm?"
        message={`"${farm.name}" and everything inside it will be removed. This cannot be undone.`}
        consequences={[
          'The farm and all of its details',
          `Every field it contains${farmFields.length ? ` (${farmFields.length})` : ''}`,
          'Associated soil records and documents',
          'Its link to any program enrolment',
        ]}
        confirmLabel="Delete Farm"
        loading={deleting}
        onConfirm={runDeleteFarm}
        onCancel={dismissDialog}
      />
    </View>
  );
};

export default FarmDetailsScreen;
