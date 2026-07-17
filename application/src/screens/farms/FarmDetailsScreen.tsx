import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import type { HeaderAction } from '../../components';
import {
  EmptyState,
  FarmSummaryCard,
  FieldCard,
  InfoRow,
  SectionHeader,
  StatCard,
  Timeline,
} from '../../components/farms';
import { COLORS, spacing } from '../../constants';
import { formatDate, formatNumber, moderateScale, scale } from '../../utils';
import {
  AppShimmer,
  AppShimmerCard,
  AppShimmerCircle,
  AppShimmerList,
  AppShimmerRow,
  AppShimmerSection,
  AppShimmerText,
  FieldCardShimmer,
  SHIMMER_RADIUS,
} from '../../components/Shimmer';
import {
  getFarmActivity,
  getFarmDocuments,
  getFarmSoil,
} from '../../data/dummyFarms';
import { FARM_STATUS_META } from '../../types/farm';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import { styles } from './FarmDetailsScreenStyle';
import { AnimatedTabBar } from '../../components';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchFarmDetailThunk,
  selectFarmDetailError,
  selectFarmDetailLoading,
  selectFarmFieldCounts,
  selectSelectedFarm,
} from '../../redux/slices/farmSlice';
import {
  fetchFarmFieldsThunk,
  selectFields,
  selectFieldsFarmId,
  selectFieldsLoading,
} from '../../redux/slices/fieldSlice';

type FarmTab = 'overview' | 'history' | 'soil' | 'documents';

const TABS: { key: FarmTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'History' },
  { key: 'soil', label: 'Soil' },
  { key: 'documents', label: 'Docs' },
];

const FIELDS_ADD_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const StatTileShimmer: React.FC = () => (
  <AppShimmerCard style={skStyles.statTile}>
    <AppShimmerCircle size={scale(36)} />
    <AppShimmer width="55%" height={moderateScale(16)} radius={SHIMMER_RADIUS.sm} />
    <AppShimmer width="42%" height={moderateScale(11)} radius={SHIMMER_RADIUS.sm} />
  </AppShimmerCard>
);

const FarmDetailsScreen: React.FC<AppScreenProps<'FarmDetails'>> = ({
  route,
  navigation,
}) => {
  const { farmId } = route.params;
  const dispatch = useAppDispatch();

  const farm = useAppSelector(selectSelectedFarm);
  const loading = useAppSelector(selectFarmDetailLoading);
  const error = useAppSelector(selectFarmDetailError);

  const fields = useAppSelector(selectFields);
  const fieldsLoading = useAppSelector(selectFieldsLoading);
  const fieldsFarmId = useAppSelector(selectFieldsFarmId);
  const fieldCounts = useAppSelector(selectFarmFieldCounts);

  const [activeTab, setActiveTab] = useState<FarmTab>('overview');

  useEffect(() => {
    if (farm?.id !== farmId) {
      dispatch(fetchFarmDetailThunk(farmId));
    }
    if (fieldsFarmId !== farmId) {
      dispatch(fetchFarmFieldsThunk(farmId));
    }
  }, [dispatch, farmId, farm, fieldsFarmId]);

  const handleHeaderAction = useCallback(
    (action: HeaderAction) => {
      if (action === 'edit') {
        navigation.navigate('AddFarm', { farmId });
      }
    },
    [navigation, farmId],
  );

  const activity = useMemo(() => getFarmActivity(farmId), [farmId]);
  const soil = useMemo(() => getFarmSoil(farmId), [farmId]);
  const documents = useMemo(() => getFarmDocuments(farmId), [farmId]);

  const goToField = useCallback(
    (fieldId: string) => navigation.navigate('FieldDetails', { farmId, fieldId }),
    [navigation, farmId],
  );

  const goToAddField = useCallback(
    () => navigation.navigate('AddField', { farmId, farmName: farm?.name }),
    [navigation, farmId, farm?.name],
  );

  if (loading) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Farm" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <AppShimmerCard>
            <AppShimmerRow showLeading leadingSize={scale(52)} lines={2} showTrailing />
            <View style={styles.gap} />
            <AppShimmerText count={4} spacing={spacing[3]} lastLineWidth="70%" />
          </AppShimmerCard>

          <View style={styles.tabContent}>
            <AppShimmerSection titleWidth={scale(96)}>
              <View style={styles.statRow}>
                <StatTileShimmer />
                <StatTileShimmer />
              </View>
              <View style={styles.statRow}>
                <StatTileShimmer />
                <StatTileShimmer />
              </View>
            </AppShimmerSection>

            <View style={styles.gap} />

            <AppShimmerSection titleWidth={scale(120)}>
              <AppShimmerList count={2} ItemComponent={FieldCardShimmer} />
            </AppShimmerSection>
          </View>
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
            {error ?? 'Something went wrong. Please try again.'}
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

  const statusMeta = FARM_STATUS_META[farm.status];

  const farmFields = fieldsFarmId === farmId ? fields : [];
  const liveCount = fieldsFarmId === farmId && !fieldsLoading ? fields.length : undefined;
  const fieldCount = liveCount ?? fieldCounts[farmId] ?? (farm.fieldsCount || undefined);
  const fieldCountLabel = fieldCount === undefined ? '-' : `${fieldCount}`;

  const renderOverview = () => (
    <>
      <SectionHeader title="Quick Stats" />
      <View style={styles.statRow}>
        <StatCard icon="view-grid-outline" label="Fields" value={fieldCountLabel} tone="info" />
        <StatCard icon="vector-square" label="Total Area" value={`${formatNumber(farm.areaAcres)} ac`} tone="neutral" />
      </View>
      <View style={styles.statRow}>
        <StatCard icon="leaf" label="Regen Index" value={`${farm.regenScore}`} tone="success" />
        <StatCard icon="calendar-outline" label="Updated" value={formatDate(farm.lastUpdatedISO)} tone="neutral" />
      </View>

      <View style={styles.gap} />
      <SectionHeader title="Farm Information" />
      <View style={styles.card}>
        <InfoRow icon="account-outline" label="Owner" value={farm.ownerName} />
        <InfoRow icon="check-decagram-outline" label="Status" value={statusMeta.label} />
        <InfoRow icon="view-grid-outline" label="Fields" value={fieldCountLabel} />
        {farm.orgName ? (
          <InfoRow icon="office-building-outline" label="Organization" value={farm.orgName} />
        ) : null}
      </View>

      <View style={styles.gap} />
      <View style={styles.fieldsHeaderRow}>
        <AppText style={styles.fieldsHeaderTitle}>{`Fields (${farmFields.length})`}</AppText>
        <Pressable
          onPress={goToAddField}
          accessibilityRole="button"
          accessibilityLabel="Add field"
          hitSlop={FIELDS_ADD_HIT_SLOP}
          style={styles.addFieldBtn}>
          <AppIcon name={ICONS.PLUS} size={moderateScale(20)} color={COLORS.white} />
        </Pressable>
      </View>
      {fieldsLoading && farmFields.length === 0 ? (
        <ActivityIndicator
          color={COLORS.primary}
          style={styles.fieldsLoader}
        />
      ) : farmFields.length > 0 ? (
        farmFields.map(field => (
          <FieldCard key={field.id} field={field} onPress={goToField} />
        ))
      ) : (
        <AppText style={styles.muted}>No fields added yet.</AppText>
      )}
    </>
  );

  const renderSoil = () =>
    soil.length > 0 ? (
      <View style={styles.soilGrid}>
        {soil.map(metric => (
          <View key={metric.id} style={styles.soilCell}>
            <StatCard icon={metric.icon} label={metric.label} value={metric.value} tone={metric.tone} />
          </View>
        ))}
      </View>
    ) : (
      <AppText style={styles.muted}>No soil data available.</AppText>
    );

  const renderDocuments = () =>
    documents.length > 0 ? (
      <View style={styles.card}>
        {documents.map((doc, index) => (
          <View
            key={doc.id}
            style={[styles.docRow, index < documents.length - 1 && styles.docDivider]}>
            <View style={styles.docIcon}>
              <AppIcon name={doc.icon} size={moderateScale(22)} color={COLORS.primary} />
            </View>
            <View style={styles.docInfo}>
              <AppText style={styles.docName} numberOfLines={1}>{doc.name}</AppText>
              <AppText style={styles.docMeta}>
                {doc.sizeLabel} · {formatDate(doc.dateISO)}
              </AppText>
            </View>
            <AppIcon name={ICONS.DOWNLOAD} size={moderateScale(20)} color={COLORS.gray500} />
          </View>
        ))}
      </View>
    ) : (
      <AppText style={styles.muted}>No documents uploaded.</AppText>
    );

  const renderHistory = () =>
    activity.length > 0 ? (
      <View style={styles.card}>
        <Timeline items={activity} />
      </View>
    ) : (
      <AppText style={styles.muted}>No activity recorded yet.</AppText>
    );

  const renderTab = () => {
    switch (activeTab) {
      case 'history': return renderHistory();
      case 'soil': return renderSoil();
      case 'documents': return renderDocuments();
      default: return renderOverview();
    }
  };

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title={farm.name}
        onBack={() => navigation.goBack()}
        rightActions={['edit']}
        onActionPress={handleHeaderAction}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <FarmSummaryCard farm={farm} fieldsCount={fieldCount} />

        <View style={styles.tabContent}>{renderTab()}</View>
      </ScrollView>
    </View>
  );
};

export default FarmDetailsScreen;

const skStyles = StyleSheet.create({
  statTile: {
    flex: 1,
    gap: spacing[1],
  },
});
