import React, { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import { EmptyState } from '../../components/farms';
import { AppShimmer, AppShimmerChip, AppShimmerList } from '../../components/Shimmer';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing, fonts } from '../../constants';
import { addAlpha, formatDate, moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useAssessorOverviewSync } from '../../hooks/useAssessorOverviewSync';
import {
  fetchAssessorFieldsThunk,
  selectAssessorError,
  selectAssessorFieldsOverview,
  selectAssessorFieldsOverviewLoading,
  selectAssessorHistory,
} from '../../redux/slices/assessorSlice';
import type { AssessorStackParamList } from '../../navigation/navigationTypes';
import type { AssessorHistoryItem } from '../../types/assessor';

const AssessorHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AssessorStackParamList>>();
  const dispatch = useAppDispatch();
  const overview = useAppSelector(selectAssessorFieldsOverview);
  const groups = useAppSelector(selectAssessorHistory);
  const loading = useAppSelector(selectAssessorFieldsOverviewLoading);
  const error = useAppSelector(selectAssessorError);

  const header = <AppHeader variant="title" title="History" rightActions={['notification']} />;

  useAssessorOverviewSync(!!overview);

  const onRefresh = useCallback(() => dispatch(fetchAssessorFieldsThunk()), [dispatch]);

  const open = useCallback(
    (it: AssessorHistoryItem) =>
      navigation.navigate('AssessorAssessmentSummary', {
        programId: it.programId,
        fieldId: it.fieldId,
        fieldName: it.fieldName,
      }),
    [navigation],
  );

  if (error && !overview) {
    return (
      <View style={styles.safe}>
        {header}
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load history</AppText>
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
          {[0, 1].map(group => (
            <View key={group} style={styles.group}>
              <AppShimmer width="45%" height={moderateScale(14)} style={styles.groupTitle} />
              <AppShimmerList
                count={3}
                spacing={0}
                renderItem={() => (
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <AppShimmer width="55%" />
                      <AppShimmer width={moderateScale(36)} />
                    </View>
                    <AppShimmer width="40%" />
                    <View style={styles.metaRow}>
                      <AppShimmerChip />
                      <AppShimmer width={moderateScale(70)} />
                    </View>
                  </View>
                )}
              />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      {header}
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }>
        {groups.length === 0 ? (
          <EmptyState icon="history" title="No history yet" message="Submitted assessments will appear here." />
        ) : (
          groups.map(group => (
            <View key={group.farmerId} style={styles.group}>
              <AppText style={styles.groupTitle}>{group.farmerName}</AppText>
              {group.items.map((it, idx) => {
                const byAssessor = it.submittedBy.role === 'assessor';
                return (
                  <TouchableOpacity key={`${it.fieldId}-${idx}`} activeOpacity={0.85} style={styles.card} onPress={() => open(it)}>
                    <View style={styles.rowBetween}>
                      <AppText style={styles.cardTitle} numberOfLines={1}>{it.fieldName} · {it.year}</AppText>
                      <AppText style={styles.pct}>{it.percentage}%</AppText>
                    </View>
                    <AppText style={styles.muted} numberOfLines={1}>{it.farmName}</AppText>
                    <View style={styles.metaRow}>
                      <View style={[styles.chip, byAssessor ? styles.chipAssessor : styles.chipFarmer]}>
                        <AppText style={styles.chipText}>By {byAssessor ? 'Assessor' : 'Farmer'}</AppText>
                      </View>
                      <View style={styles.metaRight}>
                        <AppText style={styles.muted}>{formatDate(it.submittedAtISO)}</AppText>
                        <AppIcon name={ICONS.LOCKED} size={moderateScale(14)} color={COLORS.gray500} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default AssessorHistoryScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  body: { padding: spacing[4], paddingBottom: spacing[10], flexGrow: 1 },
  group: { marginBottom: spacing[4] },
  groupTitle: { ...presets.headingXS, color: COLORS.gray900, marginBottom: spacing[2] },
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
  cardTitle: { ...presets.labelLG, color: COLORS.gray900, flexShrink: 1 },
  pct: { ...presets.labelMD, color: COLORS.success },
  muted: { ...presets.bodySM, color: COLORS.gray500 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], marginTop: spacing[1] },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  chip: { borderRadius: borderRadius.full, paddingHorizontal: spacing[2.5], paddingVertical: spacing[0.5] },
  chipText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.gray900 },
  chipFarmer: { backgroundColor: addAlpha(COLORS.info, 0.12) },
  chipAssessor: { backgroundColor: COLORS.lightPrimary },
  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4] },
  retry: { marginTop: spacing[4], minWidth: moderateScale(160) },
});
