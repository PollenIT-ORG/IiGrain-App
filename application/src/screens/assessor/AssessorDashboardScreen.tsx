import React, { useCallback, useEffect } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppStatusBadge, AppText, Button } from '../../components';
import { EmptyState, StatCard } from '../../components/farms';
import { FadeSlideIn, QuickActions, type QuickAction } from '../../components/home';
import {
  AppShimmer,
  AppShimmerChip,
  AppShimmerCircle,
  AppShimmerList,
  AppShimmerRow,
  AppShimmerSection,
  AppShimmerText,
} from '../../components/Shimmer';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing, fonts } from '../../constants';
import { addAlpha, formatDate, getInitials, moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchAssessorFieldsThunk,
  selectAssessorDashboard,
  selectAssessorDashboardLoading,
  selectAssessorError,
  selectAssessorFieldsOverview,
} from '../../redux/slices/assessorSlice';
import { selectAuthUser } from '../../redux/slices/authSlice';
import type { AssessorStackParamList } from '../../navigation/navigationTypes';
import type { AssessorHistoryItem, AssignedFarmer } from '../../types/assessor';

const scoreTone = (pct: number): { bg: string; color: string } => {
  if (pct >= 67) {
    return { bg: addAlpha(COLORS.success, 0.12), color: COLORS.success };
  }
  if (pct >= 40) {
    return { bg: addAlpha(COLORS.warning, 0.16), color: COLORS.warning };
  }
  return { bg: addAlpha(COLORS.danger, 0.12), color: COLORS.danger };
};

const AssessorDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AssessorStackParamList>>();
  const dispatch = useAppDispatch();
  const overview = useAppSelector(selectAssessorFieldsOverview);
  const dashboard = useAppSelector(selectAssessorDashboard);
  const loading = useAppSelector(selectAssessorDashboardLoading);
  const error = useAppSelector(selectAssessorError);
  const user = useAppSelector(selectAuthUser);

  useEffect(() => {
    if (!overview) {
      dispatch(fetchAssessorFieldsThunk());
    }
  }, [dispatch, overview]);

  const onRefresh = useCallback(() => {
    dispatch(fetchAssessorFieldsThunk());
  }, [dispatch]);

  const openFarmer = useCallback(
    (f: AssignedFarmer) =>
      navigation.navigate('AssessorFarmerDetail', { farmerId: f.id, farmerName: f.name }),
    [navigation],
  );
  const openHistory = useCallback(
    (it: AssessorHistoryItem) =>
      navigation.navigate('AssessorAssessmentSummary', {
        fieldId: it.fieldId,
        fieldName: it.fieldName,
      }),
    [navigation],
  );

  const goFarmers = useCallback(
    () => navigation.navigate('AssessorShell', { screen: 'AssessorFarmers' }),
    [navigation],
  );
  const goHistory = useCallback(
    () => navigation.navigate('AssessorShell', { screen: 'AssessorHistory' }),
    [navigation],
  );
  const goProfile = useCallback(() => navigation.navigate('Profile'), [navigation]);

  const quickActions: QuickAction[] = [
    { key: 'farmers', icon: 'account-group-outline', label: 'My Farmers', onPress: goFarmers },
    { key: 'history', icon: 'history', label: 'History', onPress: goHistory },
    { key: 'profile', icon: 'account-circle-outline', label: 'Profile', onPress: goProfile },
  ];

  const header = <AppHeader variant="logo" rightActions={['notification']} bgColor />;

  if (error && !overview) {
    return (
      <View style={styles.safe}>
        {header}
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load dashboard</AppText>
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
          <View style={styles.hero}>
            <View style={styles.heroRow}>
              <AppShimmerCircle size={scale(52)} />
              <View style={styles.flex}>
                <AppShimmerText count={2} width="70%" lastLineWidth="45%" />
              </View>
              <AppShimmerChip />
            </View>
            <View style={styles.heroDivider} />
            <AppShimmerText count={1} width="80%" />
          </View>

          <AppShimmerSection titleWidth="35%" style={styles.section}>
            <View style={styles.statRow}>
              <AppShimmer style={styles.flex} height={scale(84)} radius={borderRadius.xl} />
              <AppShimmer style={styles.flex} height={scale(84)} radius={borderRadius.xl} />
              <AppShimmer style={styles.flex} height={scale(84)} radius={borderRadius.xl} />
            </View>
          </AppShimmerSection>

          <AppShimmerSection titleWidth="55%" style={styles.section}>
            <AppShimmerList
              count={4}
              spacing={0}
              renderItem={() => (
                <View style={styles.card}>
                  <AppShimmerRow leadingSize={scale(42)} lines={2} showTrailing />
                </View>
              )}
            />
          </AppShimmerSection>
        </View>
      </View>
    );
  }

  const name = user?.fullName?.trim() || 'Assessor';
  const initials = getInitials(name) || 'A';
  const pending = dashboard?.counts.pending ?? 0;
  const summaryPositive = pending === 0;
  const summaryText = summaryPositive
    ? "You're all caught up - great work!"
    : `${pending} assessment${pending > 1 ? 's' : ''} pending your review`;
  const noFields = overview.fields.length === 0;

  return (
    <View style={styles.safe}>
      {header}
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={!!dashboard && loading}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        <FadeSlideIn>
          <View style={styles.hero}>
            <View style={styles.heroRow}>
              <View style={styles.avatar}>
                <AppText style={styles.avatarText}>{initials}</AppText>
              </View>
              <View style={styles.flex}>
                <AppText style={styles.heroGreeting}>Good morning,</AppText>
                <AppText style={styles.heroName} numberOfLines={1}>
                  {name}
                </AppText>
              </View>
              <View style={styles.rolePill}>
                <AppText style={styles.roleText}>Assessor</AppText>
              </View>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroSummary}>
              <AppIcon
                name={summaryPositive ? ICONS.SUCCESS : ICONS.PENDING}
                size={moderateScale(16)}
                color={summaryPositive ? COLORS.primary : COLORS.warning}
              />
              <AppText style={styles.heroSummaryText}>{summaryText}</AppText>
            </View>
          </View>
        </FadeSlideIn>

        {dashboard ? (
          <>
            <FadeSlideIn delay={80} style={styles.section}>
              <AppText style={styles.sectionTitle}>Overview</AppText>
              <View style={styles.statRow}>
                <StatCard icon="account-group-outline" label="Assigned" value={`${dashboard.counts.assigned}`} tone="info" />
                <StatCard icon="check-decagram-outline" label="Done" value={`${dashboard.counts.done}`} tone="success" />
                <StatCard icon="clock-outline" label="Pending" value={`${dashboard.counts.pending}`} tone="warning" />
              </View>
            </FadeSlideIn>

            {noFields ? (
              <FadeSlideIn delay={200} style={styles.section}>
                <EmptyState
                  icon="clipboard-text-outline"
                  title="No fields assigned yet"
                  message="Fields assigned to you for assessment will appear here."
                />
              </FadeSlideIn>
            ) : (
              <>
                <FadeSlideIn delay={200} style={styles.section}>
                  <AppText style={styles.sectionTitle}>Recent Assessments</AppText>
                  {dashboard.recent.length ? (
                    dashboard.recent.map((it, idx) => {
                      const tone = scoreTone(it.percentage);
                      const byAssessor = it.submittedBy.role === 'assessor';
                      return (
                        <TouchableOpacity
                          key={`${it.fieldId}-${idx}`}
                          activeOpacity={0.85}
                          style={styles.card}
                          onPress={() => openHistory(it)}>
                          <View style={styles.cardRow}>
                            <View style={styles.iconTile}>
                              <AppIcon name={ICONS.REVIEW} size={moderateScale(20)} color={COLORS.primary} />
                            </View>
                            <View style={styles.flex}>
                              <AppText style={styles.cardTitle} numberOfLines={1}>
                                {it.fieldName} · {it.year}
                              </AppText>
                              <AppText style={styles.cardSub} numberOfLines={1}>
                                {it.farmName}
                              </AppText>
                            </View>
                            <View style={[styles.pctBadge, { backgroundColor: tone.bg }]}>
                              <AppText style={[styles.pctText, { color: tone.color }]}>
                                {it.percentage}%
                              </AppText>
                            </View>
                          </View>
                          <View style={styles.cardFooter}>
                            <View style={[styles.chip, byAssessor ? styles.chipAssessor : styles.chipFarmer]}>
                              <AppText style={styles.chipText}>
                                By {byAssessor ? 'Assessor' : 'Farmer'}
                              </AppText>
                            </View>
                            <AppText style={styles.muted}>{formatDate(it.submittedAtISO)}</AppText>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <AppText style={styles.muted}>No recent assessments yet.</AppText>
                  )}
                </FadeSlideIn>

                {dashboard.assignedPreview.length > 0 ? (
                  <FadeSlideIn delay={260} style={styles.section}>
                    <AppText style={styles.sectionTitle}>Assigned Farmers</AppText>
                    {dashboard.assignedPreview.map(f => (
                      <TouchableOpacity
                        key={f.id}
                        activeOpacity={0.85}
                        style={styles.card}
                        onPress={() => openFarmer(f)}>
                        <View style={styles.cardRow}>
                          <View style={styles.avatarTile}>
                            <AppText style={styles.avatarTileText}>
                              {getInitials(f.name) || 'F'}
                            </AppText>
                          </View>
                          <View style={styles.flex}>
                            <AppText style={styles.cardTitle} numberOfLines={1}>
                              {f.name}
                            </AppText>
                            <AppText style={styles.cardSub} numberOfLines={1}>
                              {f.farmsCount} farms · {f.fieldsCount} fields
                            </AppText>
                          </View>
                          <AppStatusBadge
                            status={f.pendingCount > 0 ? 'pending' : 'completed'}
                            label={f.pendingCount > 0 ? `${f.pendingCount} pending` : 'All done'}
                            size="sm"
                          />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </FadeSlideIn>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default AssessorDashboardScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  body: { padding: spacing[4], paddingBottom: spacing[10] },
  flex: { flex: 1 },
  muted: { ...presets.bodySM, color: COLORS.gray500 },

  hero: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    ...shadows.md,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  avatarText: { ...presets.headingSM, color: COLORS.white },
  heroGreeting: { ...presets.bodySM, color: COLORS.gray600 },
  heroName: { ...presets.headingMD, color: COLORS.gray900 },
  rolePill: {
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
  },
  roleText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.primaryDark },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray200,
    marginVertical: spacing[3],
  },
  heroSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  heroSummaryText: { ...presets.bodySM, color: COLORS.gray700, flex: 1 },

  section: { marginTop: spacing[5] },
  sectionTitle: { ...presets.headingSM, color: COLORS.gray900, marginBottom: spacing[3] },
  statRow: { flexDirection: 'row', gap: spacing[3] },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconTile: {
    width: scale(42),
    height: scale(42),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTile: {
    width: scale(42),
    height: scale(42),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTileText: { ...presets.labelMD, color: COLORS.primaryDark, fontFamily: fonts.semibold },
  cardTitle: { ...presets.labelLG, color: COLORS.gray900 },
  cardSub: { ...presets.bodyXS, color: COLORS.gray500, marginTop: scale(2) },
  pctBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
  },
  pctText: { ...presets.labelMD, fontFamily: fonts.semibold },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    marginTop: spacing[3],
    paddingTop: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray200,
  },
  chip: { borderRadius: borderRadius.full, paddingHorizontal: spacing[2.5], paddingVertical: spacing[0.5] },
  chipText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.gray900 },
  chipFarmer: { backgroundColor: addAlpha(COLORS.info, 0.12) },
  chipAssessor: { backgroundColor: COLORS.lightPrimary },

  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4] },
  retry: { marginTop: spacing[4], minWidth: moderateScale(160) },
});
