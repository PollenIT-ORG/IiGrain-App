import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import FieldSelectSheet, {
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
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
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

/** The 409 for an in-progress assessment is the only one that offers a way
 *  forward, and it is the only message that mentions discarding. */
const isDiscardFirst = (message?: string): boolean =>
  !!message && message.toLowerCase().includes('discard');

/** Programs/enrollable fields change rarely; a 5-minute ceiling is plenty on top
 *  of the socket invalidation that already covers real changes. */
const ENROLL_TTL_MS = 5 * 60 * 1000;

type RemovePrompt = { field: SelectableField; programId: string };
type DiscardPrompt = { message: string; programId: string; fieldId: string };

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

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Confirmations are app-styled dialogs, never native alerts.
  const [removePrompt, setRemovePrompt] = useState<RemovePrompt | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState<DiscardPrompt | null>(null);
  const [errorPrompt, setErrorPrompt] = useState<string | null>(null);

  const loadPrograms = useCallback(
    () => dispatch(fetchAvailableProgramsThunk()),
    [dispatch],
  );
  const loadFields = useCallback(
    () => dispatch(fetchEnrollableFieldsThunk()),
    [dispatch],
  );

  // EnrollNow is a tab that stays mounted, and this used to refetch BOTH lists
  // on every FAB tap. Now it loads once and refetches only when an enrolment
  // actually changes (socket `sync`, or a local enrol/unenrol) or after 5 min.
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
  });

  const selectedProgram = programs.find(p => p.id === selectedProgramId) ?? null;
  const alreadyEnrolled = !!selectedProgram?.alreadyEnrolled;

  // New backend returns each program's own fields (with a per-field `enrolled`
  // flag). Old backend omits them → fall back to the flat enrollable list.
  const sheetFields = useMemo<SelectableField[]>(() => {
    const own = selectedProgram?.fields ?? [];
    if (own.length > 0) {
      return own;
    }
    return fields.map(f => ({ ...f, enrolled: false }));
  }, [selectedProgram, fields]);

  // Only the user's newly-checked, NOT-already-enrolled fields — this is the
  // exact payload we submit. Kept airtight even if a background refetch flips a
  // selected field to enrolled=true (so an enrolled id can never reach the POST).
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

  /** Land the user on the Assessment tab so the new assessment is right there.
   *  That screen refetches on focus, so the freshly enrolled field shows up. */
  const goToAssessments = useCallback(
    () => navigation.navigate('Assessment'),
    [navigation],
  );

  const goToFarms = useCallback(() => navigation.navigate('Farms'), [navigation]);

  const onEnroll = useCallback(async () => {
    if (!selectedProgramId || newFieldIds.length === 0) {
      return;
    }
    const wasEnrolled = alreadyEnrolled;
    const action = await dispatch(
      enrollSelfThunk({
        programId: selectedProgramId,
        input: { fieldIds: newFieldIds },
      }),
    );

    if (!enrollSelfThunk.fulfilled.match(action)) {
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
  }, [dispatch, newFieldIds, alreadyEnrolled, selectedProgramId, goToAssessments]);

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

  const renderProgram = (p: AvailableProgram) => {
    const selected = p.id === selectedProgramId;
    const range = dateRange(p.startDateISO, p.endDateISO);
    const capacity =
      p.userLimit != null ? `${p.enrolledCount}/${p.userLimit}` : `${p.enrolledCount}`;
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
            </View>
            {p.description ? (
              <AppText style={styles.progDesc} numberOfLines={2}>{p.description}</AppText>
            ) : null}
          </View>
          {blocked ? (
            <View style={styles.fullBadge}>
              <AppText style={styles.fullText}>Full</AppText>
            </View>
          ) : (
            <AppIcon
              name={ICONS.CHEVRON_RIGHT}
              size={moderateScale(22)}
              color={COLORS.primary}
            />
          )}
        </View>

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

  const renderBody = () => {
    if (loadingPrograms && !hasPrograms) {
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
        <View style={styles.center}>
          <EmptyState
            icon="clipboard-text-outline"
            title="No programs available"
            message="There are no programs open for enrollment right now. Please check back later."
            actionLabel="Refresh"
            onAction={loadPrograms}
          />
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <AppIcon name={ICONS.HANDSHAKE} size={moderateScale(22)} color={COLORS.primary} />
          </View>
          <View style={styles.flex}>
            <AppText style={styles.heroTitle}>Join a program to begin</AppText>
            <AppText style={styles.heroText}>
              Pick a program, choose the fields you want assessed, and you're ready to start.
            </AppText>
          </View>
        </View>

        <AppText style={styles.sectionTitle}>Choose a program</AppText>
        {programs.map(renderProgram)}
      </ScrollView>
    );
  };

  return (
    <View style={styles.safe}>
      {/* Tab root, not a pushed screen — drawer affordance instead of a back arrow. */}
      <AppHeader variant="title" title="Enroll Now" showDrawer />

      {renderBody()}

      <FieldSelectSheet
        visible={sheetOpen}
        programName={selectedProgram?.name ?? ''}
        alreadyEnrolled={alreadyEnrolled}
        fields={sheetFields}
        selectedIds={selectedFieldIds}
        loading={loadingFields}
        enrolling={enrolling}
        unenrollingFieldId={unenrollingFieldId}
        errorMessage={fieldsError}
        onRetry={loadFields}
        onToggle={toggleField}
        onRemove={requestRemove}
        onEnroll={onEnroll}
        onGoToFarms={goToFarms}
        onClose={closeSheet}
        // Dialogs live INSIDE the sheet's modal so they layer correctly on iOS.
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
    </View>
  );
};

export default EnrollNowScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  body: { padding: spacing[4], paddingBottom: spacing[6] },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
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

  sectionTitle: { ...presets.headingXS, color: COLORS.gray900, marginBottom: spacing[3] },
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
    marginBottom: spacing[3],
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
  ctaText: { ...presets.labelSM, color: COLORS.primary },
});
