import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import FieldSelectSheet, {
  type FieldSheetEmptyState,
  type SelectableField,
} from '../../components/enroll/FieldSelectSheet';
import { EmptyState } from '../../components/farms';
import {
  AppShimmer,
  AppShimmerCircle,
  AppShimmerText,
} from '../../components/Shimmer';
import { COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing, fonts } from '../../constants';
import { addAlpha, formatDate, moderateScale, scale } from '../../utils';
import { openExternalUrl } from '../../utils/openExternalUrl';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
import { invalidateTags } from '../../redux/slices/syncSlice';
import {
  enrollSelfThunk,
  unenrollFieldThunk,
  fetchAvailableProgramsThunk,
  fetchEnrollableFieldsThunk,
  selectAvailablePrograms,
  selectEnrollableFields,
  selectProgramsLoaded,
  selectEnrollableFieldsLoaded,
  selectEnrolling,
  selectUnenrollingFieldId,
  selectEnrollmentFieldsLoading,
  selectEnrollmentProgramsLoading,
  selectFieldsError,
  selectProgramsError,
} from '../../redux/slices/enrollmentSlice';
import {
  selectDashboardFarms,
  selectDashboardFarmsLoaded,
} from '../../redux/slices/dashboardSlice';
import { selectFarms, selectFarmsMeta } from '../../redux/slices/farmSlice';
import { showSuccess, showToast } from '../../services/toastService';
import { discardAssessmentThunk } from '../../redux/slices/assessmentSlice';
import type { TabScreenProps } from '../../navigation/navigationTypes';
import type { AvailableProgram } from '../../types/enrollment';

const dateRange = (start: string | null, end: string | null): string | null => {
  if (start && end) {
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  if (start) {
    return `From ${formatDate(start)}`;
  }
  if (end) {
    return `Until ${formatDate(end)}`;
  }
  return null;
};

const isDiscardFirst = (message?: string): boolean =>
  !!message && message.toLowerCase().includes('discard');

const ENROLL_TTL_MS = 5 * 60 * 1000;

const canActOn = (p: AvailableProgram): boolean => p.canEnroll || p.alreadyEnrolled;

const SURVEY_FALLBACK =
  "Please complete this program's survey first. You can enroll once your Enrollment ID for it has been issued.";

type RemovePrompt = { field: SelectableField; programId: string };
type DiscardPrompt = { message: string; programId: string; fieldId: string };
type SurveyPrompt = { message: string; surveyUrl: string | null };

const EnrollNowScreen: React.FC<TabScreenProps<'EnrollNow'>> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const programs = useAppSelector(selectAvailablePrograms);
  const fields = useAppSelector(selectEnrollableFields);
  const loadingPrograms = useAppSelector(selectEnrollmentProgramsLoading);
  const loadingFields = useAppSelector(selectEnrollmentFieldsLoading);
  const enrolling = useAppSelector(selectEnrolling);
  const unenrollingFieldId = useAppSelector(selectUnenrollingFieldId);
  const programsError = useAppSelector(selectProgramsError);
  const fieldsError = useAppSelector(selectFieldsError);
  const programsLoaded = useAppSelector(selectProgramsLoaded);
  const fieldsLoaded = useAppSelector(selectEnrollableFieldsLoaded);
  const dashboardFarms = useAppSelector(selectDashboardFarms);
  const dashboardFarmsLoaded = useAppSelector(selectDashboardFarmsLoaded);
  const farms = useAppSelector(selectFarms);
  const farmsMeta = useAppSelector(selectFarmsMeta);

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [removePrompt, setRemovePrompt] = useState<RemovePrompt | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState<DiscardPrompt | null>(null);
  const [errorPrompt, setErrorPrompt] = useState<string | null>(null);
  const [surveyPrompt, setSurveyPrompt] = useState<SurveyPrompt | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadPrograms = useCallback(
    () => dispatch(fetchAvailableProgramsThunk()),
    [dispatch],
  );
  const loadFields = useCallback(
    () => dispatch(fetchEnrollableFieldsThunk()),
    [dispatch],
  );

  useSyncedFetch({
    tags: [Tags.programs],
    run: loadPrograms,
    hasData: programsLoaded,
    ttlMs: ENROLL_TTL_MS,
  });
  useSyncedFetch({
    tags: [Tags.enrollableFields],
    run: loadFields,
    hasData: fieldsLoaded,
    ttlMs: ENROLL_TTL_MS,
    enabled: sheetOpen,
  });

  const selectedProgram = programs.find(p => p.id === selectedProgramId) ?? null;
  const alreadyEnrolled = !!selectedProgram?.alreadyEnrolled;

  const { enrollable, discoverable } = useMemo(() => {
    const ready: AvailableProgram[] = [];
    const open: AvailableProgram[] = [];
    programs.forEach(p => (canActOn(p) ? ready : open).push(p));
    return { enrollable: ready, discoverable: open };
  }, [programs]);

  const sheetFields = useMemo<SelectableField[]>(() => {
    const own = selectedProgram?.fields ?? [];
    if (own.length > 0) {
      return own;
    }
    return fields.map(f => ({ ...f, enrolled: false }));
  }, [selectedProgram, fields]);

  const newFieldIds = useMemo(
    () =>
      selectedFieldIds.filter(
        id => !sheetFields.some(f => f.id === id && f.enrolled),
      ),
    [selectedFieldIds, sheetFields],
  );

  const openSheetFor = useCallback((id: string) => {
    setSelectedProgramId(id);
    setSelectedFieldIds([]);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const toggleField = useCallback((id: string) => {
    setSelectedFieldIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }, []);

  const hasPrograms = programs.length > 0;

  const goToAssessments = useCallback(
    () => navigation.navigate('Assessment'),
    [navigation],
  );

  const goToFarms = useCallback(() => {
    setSheetOpen(false);
    navigation.navigate('Farms');
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchAvailableProgramsThunk()),
        fieldsLoaded ? dispatch(fetchEnrollableFieldsThunk()) : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, fieldsLoaded]);

  const openSurvey = useCallback((url: string | null) => {
    openExternalUrl(url, "We couldn't open this program's survey. Please try again.");
  }, []);

  const sheetEmptyState = useMemo<FieldSheetEmptyState>(() => {
    const farmCount = Math.max(dashboardFarms.length, farms.length);
    if (farmCount > 0) {
      return {
        icon: ICONS.FIELD,
        title: 'No fields to enroll',
        message:
          'Your farms have no fields left to enroll. Add a field to join this program.',
        actionLabel: 'Add a field',
        onAction: goToFarms,
      };
    }
    if (dashboardFarmsLoaded || farmsMeta !== null) {
      return {
        icon: ICONS.FARM,
        title: 'No farms yet',
        message:
          'Create a farm and add a field to it. Fields are what you enroll into a program.',
        actionLabel: 'Create a farm',
        onAction: goToFarms,
      };
    }
    return {
      icon: ICONS.FIELD,
      title: 'Nothing to enroll yet',
      message:
        'You need a farm with at least one field before you can join this program.',
      actionLabel: 'Go to Farms',
      onAction: goToFarms,
    };
  }, [dashboardFarms.length, dashboardFarmsLoaded, farms.length, farmsMeta, goToFarms]);

  const onEnroll = useCallback(async () => {
    if (!selectedProgramId || newFieldIds.length === 0) {
      return;
    }
    const wasEnrolled = alreadyEnrolled;
    const surveyUrl = selectedProgram?.surveyUrl ?? null;
    const action = await dispatch(
      enrollSelfThunk({
        programId: selectedProgramId,
        input: { fieldIds: newFieldIds },
      }),
    );

    if (!enrollSelfThunk.fulfilled.match(action)) {
      if (action.payload?.code === 'SURVEY_REQUIRED') {
        setSheetOpen(false);
        setSurveyPrompt({
          message: action.payload.message || SURVEY_FALLBACK,
          surveyUrl,
        });
        dispatch(invalidateTags([Tags.programs]));
        return;
      }
      showToast(action.payload?.message ?? 'Could not enroll. Please try again.', {
        type: 'error',
      });
      return;
    }

    setSelectedFieldIds([]);
    setSheetOpen(false);
    showSuccess(
      wasEnrolled
        ? 'Fields added — they can now be assessed.'
        : 'Enrolled successfully — your assessment is ready.',
    );
    goToAssessments();
  }, [
    dispatch,
    newFieldIds,
    alreadyEnrolled,
    selectedProgramId,
    selectedProgram,
    goToAssessments,
  ]);

  const runUnenroll = useCallback(
    async (programId: string, fieldId: string): Promise<void> => {
      const action = await dispatch(unenrollFieldThunk({ programId, fieldId }));
      if (unenrollFieldThunk.fulfilled.match(action)) {
        showSuccess(
          action.payload.enrollmentRemoved
            ? 'Field removed — you are no longer enrolled in this program.'
            : 'Field removed from the program.',
        );
        setSelectedFieldIds(prev => prev.filter(id => id !== fieldId));
        return;
      }
      const message = action.payload?.message;
      if (isDiscardFirst(message)) {
        setDiscardPrompt({ message: message as string, programId, fieldId });
        return;
      }
      setErrorPrompt(message ?? 'Please try again.');
    },
    [dispatch],
  );

  const onConfirmRemove = useCallback(() => {
    if (!removePrompt) {
      return;
    }
    const { programId, field } = removePrompt;
    setRemovePrompt(null);
    runUnenroll(programId, field.id);
  }, [removePrompt, runUnenroll]);

  const onConfirmDiscard = useCallback(async () => {
    if (!discardPrompt) {
      return;
    }
    const { programId, fieldId } = discardPrompt;
    setDiscardPrompt(null);
    const discarded = await dispatch(discardAssessmentThunk({ programId, fieldId }));
    if (discardAssessmentThunk.fulfilled.match(discarded)) {
      await runUnenroll(programId, fieldId);
    } else {
      setErrorPrompt(
        discarded.payload?.message ?? 'Could not discard the assessment.',
      );
    }
  }, [discardPrompt, dispatch, runUnenroll]);

  const requestRemove = useCallback(
    (field: SelectableField) => {
      if (selectedProgramId) {
        setRemovePrompt({ field, programId: selectedProgramId });
      }
    },
    [selectedProgramId],
  );

  const onConfirmSurveyPrompt = useCallback(() => {
    const url = surveyPrompt?.surveyUrl ?? null;
    setSurveyPrompt(null);
    if (url) {
      openSurvey(url);
    }
  }, [surveyPrompt, openSurvey]);

  const renderProgramHead = (p: AvailableProgram, trailing: React.ReactNode) => (
    <View style={styles.cardTop}>
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <AppText style={styles.progName} numberOfLines={1}>{p.name}</AppText>
          {p.code ? (
            <View style={styles.codeChip}>
              <AppText style={styles.codeText}>{p.code}</AppText>
            </View>
          ) : null}
          {p.alreadyEnrolled ? (
            <View style={styles.enrolledChip}>
              <AppText style={styles.enrolledChipText}>Enrolled</AppText>
            </View>
          ) : null}
          {!canActOn(p) ? (
            <View style={styles.applyChip}>
              <AppText style={styles.applyChipText}>Survey required</AppText>
            </View>
          ) : null}
        </View>
        {p.description ? (
          <AppText style={styles.progDesc} numberOfLines={2}>{p.description}</AppText>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  const renderMeta = (p: AvailableProgram) => {
    const range = dateRange(p.startDateISO, p.endDateISO);
    const capacity =
      p.userLimit != null ? `${p.enrolledCount}/${p.userLimit}` : `${p.enrolledCount}`;
    return (
      <View style={styles.metaRow}>
        {range ? (
          <View style={styles.metaItem}>
            <AppIcon name={ICONS.CALENDAR_RANGE} size={moderateScale(14)} color={COLORS.gray600} />
            <AppText style={styles.metaText}>{range}</AppText>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <AppIcon name={ICONS.USERS} size={moderateScale(14)} color={COLORS.gray600} />
          <AppText style={styles.metaText}>{capacity} enrolled</AppText>
        </View>
      </View>
    );
  };

  const renderDiscoveryCard = (p: AvailableProgram) => {
    const actionable = !!p.surveyUrl;
    return (
      <TouchableOpacity
        key={p.id}
        activeOpacity={actionable ? 0.85 : 1}
        disabled={!actionable}
        onPress={() => openSurvey(p.surveyUrl)}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}. ${
          actionable ? 'Take the survey to apply. Opens in your browser.' : 'Not open yet.'
        }`}
        style={[styles.card, !actionable && styles.cardDisabled]}>
        {renderProgramHead(
          p,
          actionable ? (
            <AppIcon
              name={ICONS.OPEN_IN_NEW}
              size={moderateScale(18)}
              color={COLORS.validation}
            />
          ) : null,
        )}

        {renderMeta(p)}

        <View style={styles.cta}>
          <AppIcon
            name={actionable ? ICONS.SURVEY : ICONS.CLOCK}
            size={moderateScale(15)}
            color={actionable ? COLORS.validation : COLORS.gray500}
          />
          <AppText style={[styles.ctaText, styles.ctaApplyText, !actionable && styles.ctaMuted]}>
            {actionable
              ? 'Apply — take the survey in your browser'
              : 'Applications are not open yet'}
          </AppText>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEnrollCard = (p: AvailableProgram) => {
    const selected = p.id === selectedProgramId;
    const blocked = p.isFull && !p.alreadyEnrolled;
    const ownFields = p.fields ?? [];
    const openCount = ownFields.filter(f => !f.enrolled).length;

    return (
      <TouchableOpacity
        key={p.id}
        activeOpacity={blocked ? 1 : 0.85}
        disabled={blocked}
        onPress={() => openSheetFor(p.id)}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}. Choose fields to enroll.`}
        style={[styles.card, selected && styles.cardSelected, blocked && styles.cardDisabled]}>
        {renderProgramHead(
          p,
          blocked ? (
            <View style={styles.fullBadge}>
              <AppText style={styles.fullText}>Full</AppText>
            </View>
          ) : (
            <AppIcon
              name={ICONS.CHEVRON_RIGHT}
              size={moderateScale(22)}
              color={COLORS.primary}
            />
          ),
        )}

        {renderMeta(p)}

        {!blocked ? (
          <View style={styles.cta}>
            <AppIcon name={ICONS.FIELD} size={moderateScale(15)} color={COLORS.primary} />
            <AppText style={styles.ctaText}>
              {ownFields.length === 0
                ? 'Choose fields'
                : openCount === 0
                ? 'All fields enrolled'
                : `${openCount} field${openCount === 1 ? '' : 's'} available`}
            </AppText>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderSection = (
    title: string,
    note: string | null,
    items: AvailableProgram[],
    render: (p: AvailableProgram) => React.ReactNode,
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <AppText style={styles.sectionTitle}>{title}</AppText>
        <View style={styles.countChip}>
          <AppText style={styles.countText}>{items.length}</AppText>
        </View>
      </View>
      {note ? <AppText style={styles.sectionNote}>{note}</AppText> : null}
      {items.map(render)}
    </View>
  );

  const renderBody = () => {
    if (loadingPrograms && !hasPrograms && !refreshing) {
      return (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <AppShimmer height={scale(76)} radius={borderRadius.xl} style={styles.loadingHero} />
          <AppShimmer width="45%" height={moderateScale(14)} radius={borderRadius.sm} style={styles.loadingTitle} />
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.flex}>
                  <AppShimmer width="60%" height={moderateScale(14)} radius={borderRadius.sm} />
                  <AppShimmerText count={2} width="90%" lastLineWidth="70%" style={styles.loadingCardDesc} />
                </View>
                <AppShimmerCircle size={moderateScale(22)} />
              </View>
              <View style={styles.metaRow}>
                <AppShimmer width="40%" height={moderateScale(10)} radius={borderRadius.sm} />
                <AppShimmer width="30%" height={moderateScale(10)} radius={borderRadius.sm} />
              </View>
            </View>
          ))}
        </ScrollView>
      );
    }

    if (programsError && !hasPrograms) {
      return (
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load programs</AppText>
          <AppText style={styles.muted}>{programsError}</AppText>
          <Button title="Retry" onPress={loadPrograms} fullWidth={false} style={styles.retryLg} />
        </View>
      );
    }

    if (!hasPrograms) {
      return (
        <ScrollView
          contentContainerStyle={styles.centerScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }>
          <EmptyState
            icon="clipboard-text-outline"
            title="No programs available"
            message="There are no programs open for enrollment right now. Please check back later."
            actionLabel="Refresh"
            onAction={loadPrograms}
          />
        </ScrollView>
      );
    }

    const canEnrollAny = enrollable.length > 0;
    const mixed = canEnrollAny && discoverable.length > 0;

    return (
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <AppIcon
              name={canEnrollAny ? ICONS.HANDSHAKE : ICONS.SURVEY}
              size={moderateScale(22)}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.flex}>
            <AppText style={styles.heroTitle}>
              {canEnrollAny ? 'Join a program to begin' : 'Apply to get started'}
            </AppText>
            <AppText style={styles.heroText}>
              {canEnrollAny
                ? "Pick a program, choose the fields you want assessed, and you're ready to start."
                : 'Take a program’s survey. Once your Enrollment ID is issued, you can enroll your fields.'}
            </AppText>
          </View>
        </View>

        {canEnrollAny
          ? renderSection(
              mixed ? 'Ready to enroll' : 'Choose a program',
              mixed ? 'Your Enrollment ID has been issued for these.' : null,
              enrollable,
              renderEnrollCard,
            )
          : null}

        {discoverable.length > 0
          ? renderSection(
              mixed ? 'Open for applications' : 'Programs you can apply for',
              'Take the survey to get an Enrollment ID for these.',
              discoverable,
              renderDiscoveryCard,
            )
          : null}
      </ScrollView>
    );
  };

  return (
    <View style={styles.safe}>
      <AppHeader variant="title" title="Enroll Now" showDrawer />

      {renderBody()}

      <FieldSelectSheet
        visible={sheetOpen}
        programName={selectedProgram?.name ?? ''}
        alreadyEnrolled={alreadyEnrolled}
        fields={sheetFields}
        selectedIds={selectedFieldIds}
        loading={loadingFields || (!fieldsLoaded && !fieldsError)}
        enrolling={enrolling}
        unenrollingFieldId={unenrollingFieldId}
        errorMessage={fieldsError}
        emptyState={sheetEmptyState}
        onRetry={loadFields}
        onToggle={toggleField}
        onRemove={requestRemove}
        onEnroll={onEnroll}
        onClose={closeSheet}
        overlay={
          <>
            <ConfirmDialog
              embedded
              visible={!!removePrompt}
              tone="danger"
              icon={ICONS.DELETE}
              title="Remove field"
              message={
                removePrompt
                  ? `Remove "${removePrompt.field.name}" from this program? You can enroll it again later.`
                  : undefined
              }
              confirmLabel="Remove"
              cancelLabel="Cancel"
              onConfirm={onConfirmRemove}
              onClose={() => setRemovePrompt(null)}
            />

            <ConfirmDialog
              embedded
              visible={!!discardPrompt}
              tone="danger"
              icon={ICONS.WARNING}
              title="Assessment in progress"
              message={discardPrompt?.message}
              confirmLabel="Discard & Remove"
              cancelLabel="Cancel"
              onConfirm={onConfirmDiscard}
              onClose={() => setDiscardPrompt(null)}
            />

            <ConfirmDialog
              embedded
              visible={!!errorPrompt}
              tone="primary"
              icon={ICONS.INFO}
              title="Cannot remove field"
              message={errorPrompt ?? undefined}
              confirmLabel="OK"
              onConfirm={() => setErrorPrompt(null)}
              onClose={() => setErrorPrompt(null)}
            />
          </>
        }
      />

      <ConfirmDialog
        visible={!!surveyPrompt}
        tone="primary"
        icon={ICONS.SURVEY}
        title="Survey needed first"
        message={surveyPrompt?.message}
        confirmLabel={surveyPrompt?.surveyUrl ? 'Take survey' : 'OK'}
        cancelLabel={surveyPrompt?.surveyUrl ? 'Not now' : undefined}
        onConfirm={onConfirmSurveyPrompt}
        onClose={() => setSurveyPrompt(null)}
      />
    </View>
  );
};

export default EnrollNowScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  body: { padding: spacing[4], paddingBottom: spacing[6] },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  centerScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  stateTitle: { ...presets.headingSM, color: COLORS.gray900, marginTop: spacing[4], textAlign: 'center' },
  retryLg: { marginTop: spacing[4], minWidth: moderateScale(180) },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[5],
  },
  heroIcon: {
    width: scale(44), height: scale(44), borderRadius: borderRadius.full,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { ...presets.headingSM, color: COLORS.gray900 },
  heroText: { ...presets.bodyXS, color: COLORS.gray700, marginTop: spacing[0.5] },

  section: { marginBottom: spacing[2] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  sectionTitle: { ...presets.headingXS, color: COLORS.gray900 },
  countChip: {
    minWidth: scale(22),
    alignItems: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray100,
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
  },
  countText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.gray700 },
  sectionNote: { ...presets.caption, color: COLORS.gray600, marginTop: spacing[1] },
  loadingHero: { marginBottom: spacing[5] },
  loadingTitle: { marginBottom: spacing[3] },
  loadingCardDesc: { marginTop: spacing[1] },
  muted: { ...presets.bodySM, color: COLORS.gray500, textAlign: 'center' },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.medium,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    marginTop: spacing[3],
    gap: spacing[2],
    ...shadows.sm,
  },
  cardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.lightPrimaryBg },
  cardDisabled: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexShrink: 1, flexWrap: 'wrap' },
  progName: { ...presets.labelLG, color: COLORS.gray900, flexShrink: 1 },
  codeChip: {
    borderRadius: borderRadius.sm, backgroundColor: COLORS.lightPrimary,
    paddingHorizontal: spacing[1.5], paddingVertical: spacing[0.5],
  },
  codeText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.primaryDark },
  enrolledChip: {
    borderRadius: borderRadius.full, backgroundColor: addAlpha(COLORS.success, 0.14),
    paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
  },
  enrolledChipText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.success },
  applyChip: {
    borderRadius: borderRadius.full, backgroundColor: addAlpha(COLORS.validation, 0.12),
    paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
  },
  applyChipText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.validation },
  progDesc: { ...presets.bodyXS, color: COLORS.gray600, marginTop: spacing[1] },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[3] },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  metaText: { ...presets.caption, color: COLORS.gray600 },
  fullBadge: {
    borderRadius: borderRadius.full, backgroundColor: addAlpha(COLORS.danger, 0.14),
    paddingHorizontal: spacing[2.5], paddingVertical: spacing[0.5],
  },
  fullText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.danger },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray200,
    paddingTop: spacing[2.5],
    marginTop: spacing[1],
  },
  ctaText: { ...presets.labelSM, color: COLORS.primary, flexShrink: 1 },
  ctaApplyText: { color: COLORS.validation },
  ctaMuted: { color: COLORS.gray600 },
});
