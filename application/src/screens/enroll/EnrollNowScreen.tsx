import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
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
import {
  enrollSelfThunk,
  fetchAvailableProgramsThunk,
  fetchEnrollableFieldsThunk,
  selectAvailablePrograms,
  selectEnrollableFields,
  selectEnrolling,
  selectEnrollmentFieldsLoading,
  selectEnrollmentProgramsLoading,
  selectFieldsError,
  selectProgramsError,
} from '../../redux/slices/enrollmentSlice';
import { showSuccess, showToast } from '../../services/toastService';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import type { AvailableProgram, EnrollableField } from '../../types/enrollment';

const dateRange = (start: string | null, end: string | null): string | null => {
  if (start && end) {
    return `${formatDate(start)} - ${formatDate(end)}`;
  }
  if (start) {
    return `From ${formatDate(start)}`;
  }
  if (end) {
    return `Until ${formatDate(end)}`;
  }
  return null;
};

const EnrollNowScreen: React.FC<AppScreenProps<'EnrollNow'>> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const programs = useAppSelector(selectAvailablePrograms);
  const fields = useAppSelector(selectEnrollableFields);
  const loadingPrograms = useAppSelector(selectEnrollmentProgramsLoading);
  const loadingFields = useAppSelector(selectEnrollmentFieldsLoading);
  const enrolling = useAppSelector(selectEnrolling);
  const programsError = useAppSelector(selectProgramsError);
  const fieldsError = useAppSelector(selectFieldsError);

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

  const insets = useSafeAreaInsets();

  const loadPrograms = useCallback(() => dispatch(fetchAvailableProgramsThunk()), [dispatch]);
  const loadFields = useCallback(() => dispatch(fetchEnrollableFieldsThunk()), [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadPrograms();
      loadFields();
    }, [loadPrograms, loadFields]),
  );

  const toggleField = useCallback((id: string) => {
    setSelectedFieldIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }, []);

  const hasPrograms = programs.length > 0;
  const selectedCount = selectedFieldIds.length;
  const canEnroll = !!selectedProgramId && selectedCount > 0 && !enrolling;

  const onEnroll = useCallback(async () => {
    if (!selectedProgramId || selectedFieldIds.length === 0) {
      return;
    }
    const action = await dispatch(
      enrollSelfThunk({
        programId: selectedProgramId,
        input: { fieldIds: selectedFieldIds },
      }),
    );
    if (enrollSelfThunk.fulfilled.match(action)) {
      showSuccess('Enrolled successfully - you can now be assessed.');
      navigation.goBack();
    } else {
      showToast(action.payload?.message ?? 'Could not enroll. Please try again.', {
        type: 'error',
      });
    }
  }, [dispatch, navigation, selectedFieldIds, selectedProgramId]);

  const renderProgram = (p: AvailableProgram) => {
    const selected = p.id === selectedProgramId;
    const range = dateRange(p.startDateISO, p.endDateISO);
    const capacity = p.userLimit != null ? `${p.enrolledCount}/${p.userLimit}` : `${p.enrolledCount}`;
    return (
      <TouchableOpacity
        key={p.id}
        activeOpacity={p.isFull ? 1 : 0.85}
        disabled={p.isFull}
        onPress={() => setSelectedProgramId(p.id)}
        style={[styles.card, selected && styles.cardSelected, p.isFull && styles.cardDisabled]}>
        <View style={styles.cardTop}>
          <View style={styles.flex}>
            <View style={styles.titleRow}>
              <AppText style={styles.progName} numberOfLines={1}>{p.name}</AppText>
              {p.code ? (
                <View style={styles.codeChip}>
                  <AppText style={styles.codeText}>{p.code}</AppText>
                </View>
              ) : null}
            </View>
            {p.description ? (
              <AppText style={styles.progDesc} numberOfLines={2}>{p.description}</AppText>
            ) : null}
          </View>
          {p.isFull ? (
            <View style={styles.fullBadge}>
              <AppText style={styles.fullText}>Full</AppText>
            </View>
          ) : (
            <AppIcon
              name={selected ? 'radiobox-marked' : 'radiobox-blank'}
              size={moderateScale(22)}
              color={selected ? COLORS.primary : COLORS.gray500}
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
      </TouchableOpacity>
    );
  };

  const renderField = (f: EnrollableField) => {
    const selected = selectedFieldIds.includes(f.id);
    return (
      <TouchableOpacity
        key={f.id}
        activeOpacity={0.85}
        onPress={() => toggleField(f.id)}
        style={[styles.fieldCard, selected && styles.cardSelected]}>
        <AppIcon
          name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={moderateScale(22)}
          color={selected ? COLORS.primary : COLORS.gray500}
        />
        <View style={styles.flex}>
          <AppText style={styles.fieldName} numberOfLines={1}>{f.name}</AppText>
          <AppText style={styles.fieldMeta} numberOfLines={1}>
            {f.crop || '-'} · {f.farmName}
          </AppText>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFields = () => {
    if (loadingFields && fields.length === 0) {
      return <ActivityIndicator color={COLORS.primary} style={styles.sectionLoader} />;
    }
    if (fieldsError && fields.length === 0) {
      return (
        <View style={styles.inlineError}>
          <AppText style={styles.muted}>{fieldsError}</AppText>
          <Button title="Retry" variant="outline" size="sm" fullWidth={false} onPress={loadFields} style={styles.retry} />
        </View>
      );
    }
    if (fields.length === 0) {
      return (
        <EmptyState
          icon="sprout-outline"
          title="No fields yet"
          message="Add a farm and a field first, then come back to enroll."
          actionLabel="Add a farm"
          onAction={() => navigation.navigate('AddFarm')}
        />
      );
    }
    return fields.map(renderField);
  };

  const renderBody = () => {
    if (loadingPrograms && !hasPrograms) {
      return (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <AppShimmer height={scale(76)} radius={borderRadius.xl} style={styles.loadingHero} />

          <AppShimmer width="45%" height={moderateScale(14)} radius={borderRadius.sm} style={styles.loadingTitle} />
          {[0, 1].map(i => (
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

          <AppShimmer
            width="45%"
            height={moderateScale(14)}
            radius={borderRadius.sm}
            style={[styles.loadingTitle, styles.sectionGap]}
          />
          {[0, 1, 2].map(i => (
            <View key={i} style={styles.fieldCard}>
              <AppShimmerCircle size={moderateScale(22)} />
              <View style={styles.flex}>
                <AppShimmer width="55%" height={moderateScale(12)} radius={borderRadius.sm} />
                <AppShimmer width="75%" height={moderateScale(10)} radius={borderRadius.sm} style={styles.loadingFieldMeta} />
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

        <AppText style={[styles.sectionTitle, styles.sectionGap]}>
          Select your fields{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </AppText>
        {renderFields()}
      </ScrollView>
    );
  };

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Enroll Now" onBack={() => navigation.goBack()} />

      {renderBody()}

      {hasPrograms ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + scale(8) }]}>
          <AppText style={styles.footerHint} numberOfLines={1}>
            {!selectedProgramId
              ? 'Select a program to continue'
              : selectedCount === 0
              ? 'Select at least one field'
              : `${selectedCount} field${selectedCount === 1 ? '' : 's'} selected`}
          </AppText>
          <Button
            title="Enroll Now"
            onPress={onEnroll}
            loading={enrolling}
            disabled={!canEnroll}
            leftIcon={<AppIcon name={ICONS.SUCCESS} size={moderateScale(20)} color={COLORS.white} />}
          />
        </View>
      ) : null}
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
  sectionGap: { marginTop: spacing[5] },
  loadingHero: { marginBottom: spacing[5] },
  loadingTitle: { marginBottom: spacing[3] },
  loadingCardDesc: { marginTop: spacing[1] },
  loadingFieldMeta: { marginTop: spacing[0.5] },
  sectionLoader: { marginVertical: spacing[6] },
  inlineError: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[4] },
  muted: { ...presets.bodySM, color: COLORS.gray500, textAlign: 'center' },
  retry: { minWidth: moderateScale(140) },

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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexShrink: 1 },
  progName: { ...presets.labelLG, color: COLORS.gray900, flexShrink: 1 },
  codeChip: {
    borderRadius: borderRadius.sm, backgroundColor: COLORS.lightPrimary,
    paddingHorizontal: spacing[1.5], paddingVertical: spacing[0.5],
  },
  codeText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.primaryDark },
  progDesc: { ...presets.bodyXS, color: COLORS.gray600, marginTop: spacing[1] },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[3] },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  metaText: { ...presets.caption, color: COLORS.gray600 },
  fullBadge: {
    borderRadius: borderRadius.full, backgroundColor: addAlpha(COLORS.danger, 0.14),
    paddingHorizontal: spacing[2.5], paddingVertical: spacing[0.5],
  },
  fullText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.danger },

  fieldCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.medium,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
    marginBottom: spacing[2.5],
    ...shadows.xs,
  },
  fieldName: { ...presets.labelMD, color: COLORS.gray900 },
  fieldMeta: { ...presets.bodyXS, color: COLORS.gray600, marginTop: spacing[0.5] },

  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray200,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[2],
    ...shadows.lg,
  },
  footerHint: { ...presets.bodyXS, color: COLORS.gray600, textAlign: 'center' },
});
