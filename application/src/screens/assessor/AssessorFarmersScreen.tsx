import React, { useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import { EmptyState } from '../../components/farms';
import { AppShimmer, AppShimmerList, AppShimmerRow } from '../../components/Shimmer';
import { COLORS, LIST_PERF, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useAssessorOverviewSync } from '../../hooks/useAssessorOverviewSync';
import {
  fetchAssessorFieldsThunk,
  selectAssessorError,
  selectAssessorFieldsOverview,
  selectAssessorFieldsOverviewLoading,
  selectAssignedFarmers,
} from '../../redux/slices/assessorSlice';
import type { AssessorStackParamList } from '../../navigation/navigationTypes';
import type { AssignedFarmer } from '../../types/assessor';

const AssessorFarmersScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AssessorStackParamList>>();
  const dispatch = useAppDispatch();
  const overview = useAppSelector(selectAssessorFieldsOverview);
  const farmers = useAppSelector(selectAssignedFarmers);
  const loading = useAppSelector(selectAssessorFieldsOverviewLoading);
  const error = useAppSelector(selectAssessorError);

  const header = <AppHeader variant="title" title="Farmers" rightActions={['notification']} />;

  useAssessorOverviewSync(!!overview);

  const onRefresh = useCallback(() => dispatch(fetchAssessorFieldsThunk()), [dispatch]);

  const open = useCallback(
    (f: AssignedFarmer) =>
      navigation.navigate('AssessorFarmerDetail', { farmerId: f.id, farmerName: f.name }),
    [navigation],
  );

  const keyExtractor = useCallback((item: AssignedFarmer) => item.id, []);

  const renderItem = useCallback<ListRenderItem<AssignedFarmer>>(
    ({ item }) => (
      <TouchableOpacity activeOpacity={0.85} style={styles.card} onPress={() => open(item)}>
        <View style={styles.rowBetween}>
          <View style={styles.nameRow}>
            <AppIcon name={ICONS.USER_CIRCLE} size={moderateScale(24)} color={COLORS.primary} />
            <AppText style={styles.name} numberOfLines={1}>{item.name}</AppText>
          </View>
          <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(22)} color={COLORS.gray500} />
        </View>
        <AppText style={styles.muted} numberOfLines={1}>{item.note ?? `${item.farmsCount} farms · ${item.fieldsCount} fields`}</AppText>
      </TouchableOpacity>
    ),
    [open],
  );

  if (error && !overview) {
    return (
      <View style={styles.safe}>
        {header}
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load farmers</AppText>
          <AppText style={styles.muted}>{error}</AppText>
          <Button title="Retry" onPress={onRefresh} fullWidth={false} style={styles.retry} />
        </View>
      </View>
    );
  }

  if (!overview) {
    return (
      <View style={styles.safe}>
        {header}
        <View style={styles.body}>
          <AppShimmerList
            count={6}
            spacing={0}
            renderItem={() => (
              <View style={styles.card}>
                <AppShimmerRow leadingSize={moderateScale(24)} lines={1} showTrailing />
                <AppShimmer width="65%" />
              </View>
            )}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      {header}
      <FlatList
        data={farmers}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        {...LIST_PERF}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="account-group-outline"
            title="No farmers assigned"
            message="When an administrator assigns you to a farmer, they'll appear here."
          />
        }
      />
    </View>
  );
};

export default AssessorFarmersScreen;

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
    gap: spacing[1.5],
    ...shadows.sm,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexShrink: 1 },
  name: { ...presets.labelLG, color: COLORS.gray900, flexShrink: 1 },
  muted: { ...presets.bodySM, color: COLORS.gray500 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], marginTop: spacing[1] },
  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4] },
  retry: { marginTop: spacing[4], minWidth: moderateScale(160) },
});
