import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import { VisitMap, checkArrival, formatDistance } from '../../maps';
import { ensureTrackingLocation } from '../../services/locationGate';
import { confirm } from '../../services/confirmService';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  arriveVisitThunk,
  endVisitThunk,
  fetchVisitTrackThunk,
  selectActiveVisit,
  selectVisitEnding,
  selectVisitTrail,
} from '../../redux/slices/visitSlice';
import {
  fetchAssessorFieldsThunk,
  selectAssessorFieldsOverview,
} from '../../redux/slices/assessorSlice';
import { isVisitTerminal } from '../../types/visit';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const AssessorVisitScreen: React.FC<AssessorScreenProps<'AssessorVisit'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const visit = useAppSelector(selectActiveVisit);
  const ending = useAppSelector(selectVisitEnding);
  const trail = useAppSelector(selectVisitTrail);
  const visitId = visit?.id;

  useEffect(() => {
    if (visitId) {
      dispatch(fetchVisitTrackThunk(visitId));
    }
  }, [dispatch, visitId]);

  useEffect(() => {
    if (visit && isVisitTerminal(visit.status)) {
      navigation.goBack();
    }
  }, [visit, navigation]);

  const overview = useAppSelector(selectAssessorFieldsOverview);
  useEffect(() => {
    if (!overview) {
      dispatch(fetchAssessorFieldsThunk());
    }
  }, [overview, dispatch]);

  const fieldId = visit?.fieldId;
  const entry = useMemo(
    () =>
      fieldId ? overview?.fields.find(f => f.field.id === fieldId) ?? null : null,
    [overview, fieldId],
  );

  const [checkingArrival, setCheckingArrival] = useState(false);

  const onArrive = useCallback(async () => {
    if (!visitId) {
      return;
    }
    setCheckingArrival(true);
    const fix = await ensureTrackingLocation({
      purpose: 'confirm you have reached the field',
    });
    setCheckingArrival(false);
    if (!fix) {
      return;
    }

    const result = checkArrival({
      position: fix,
      boundary: visit?.fieldBoundary,
      destination:
        visit?.destLat != null && visit?.destLng != null
          ? { latitude: visit.destLat, longitude: visit.destLng }
          : null,
    });

    const position = {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracyM: fix.accuracyM,
      isMock: fix.isMock,
    };

    if (result.atField) {
      dispatch(arriveVisitThunk({ visitId, position }));
      return;
    }

    const away =
      result.distanceM === null
        ? ''
        : ` — you look about ${formatDistance(result.distanceM)} away`;
    const proceed = await confirm({
      title: 'You may not be at the field yet',
      message: `This visit is for ${visit?.fieldName ?? 'this field'}${away}. Mark it as arrived anyway?`,
      icon: 'map-marker-alert-outline',
      confirmLabel: 'Mark arrived',
      cancelLabel: 'Not yet',
    });
    if (proceed) {
      dispatch(arriveVisitThunk({ visitId, position }));
    }
  }, [dispatch, visitId, visit]);

  const openAssessment = useCallback(() => {
    if (!entry) {
      return;
    }
    navigation.navigate('AssessorAssessmentSummary', {
      programId: entry.program.id,
      fieldId: entry.field.id,
      fieldName: entry.field.name,
    });
  }, [navigation, entry]);

  const arrived = visit?.status === 'arrived';
  const assessmentSubmitted = !!entry?.assessment.completed;
  const mustAssess = arrived && !!entry && !assessmentSubmitted;

  const confirmEnd = useCallback(async () => {
    if (!visitId) {
      return;
    }

    if (mustAssess && entry) {
      const a = entry.assessment;
      const open = await confirm({
        title: 'Submit the assessment first',
        message: `You are marked as arrived at ${
          entry.field.name || 'this field'
        }. This visit stays open until its assessment is submitted — ${
          a.answered
        } of ${a.totalQuestions} questions scored so far.`,
        icon: 'clipboard-text-outline',
        confirmLabel: 'Open assessment',
        cancelLabel: 'Not now',
      });
      if (open) {
        openAssessment();
      }
      return;
    }

    const ended = await confirm({
      title: 'End visit',
      message: 'End this visit and stop sharing your location?',
      icon: 'map-marker-check-outline',
      tone: 'danger',
      confirmLabel: 'End visit',
      cancelLabel: 'Keep tracking',
    });
    if (ended) {
      dispatch(endVisitThunk({ visitId, outcome: 'completed' })).finally(() =>
        navigation.goBack(),
      );
    }
  }, [dispatch, visitId, navigation, mustAssess, entry, openAssessment]);

  if (!visit) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Visit" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
          <AppText style={styles.centerText}>No active visit.</AppText>
        </View>
      </View>
    );
  }

  const destination =
    visit.destLat != null && visit.destLng != null
      ? { latitude: visit.destLat, longitude: visit.destLng }
      : null;
  const assessorPos =
    visit.assessorLat != null && visit.assessorLng != null
      ? { latitude: visit.assessorLat, longitude: visit.assessorLng }
      : null;
  const subtitle = [visit.farmName, visit.fieldName].filter(Boolean).join(' · ');

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Visit in progress" onBack={() => navigation.goBack()} />

      <VisitMap
        assessor={assessorPos}
        destination={destination}
        trail={trail}
        boundary={visit.fieldBoundary}
        fieldName={visit.fieldName}
        lastSeenISO={visit.lastLocationAtISO}
        style={styles.map}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <AppIcon name="account" size={moderateScale(22)} color={COLORS.primary} />
          </View>
          <View style={styles.rowTexts}>
            <AppText style={styles.name} numberOfLines={1}>
              {visit.farmerName}
            </AppText>
            <AppText style={styles.sub} numberOfLines={1}>
              {subtitle || 'Sharing your live location'}
            </AppText>
          </View>
          <View style={[styles.chip, arrived && styles.chipArrived]}>
            <AppText style={[styles.chipText, arrived && styles.chipTextArrived]}>
              {arrived ? 'Arrived' : 'En route'}
            </AppText>
          </View>
        </View>

        {arrived && entry ? (
          <Pressable
            onPress={assessmentSubmitted ? undefined : openAssessment}
            disabled={assessmentSubmitted}
            accessibilityRole={assessmentSubmitted ? undefined : 'button'}
            accessibilityLabel={
              assessmentSubmitted ? undefined : 'Open the assessment for this field'
            }
            style={({ pressed }) => [
              styles.assessStrip,
              assessmentSubmitted ? styles.assessDone : styles.assessPending,
              pressed && styles.assessPressed,
            ]}>
            <AppIcon
              name={assessmentSubmitted ? 'check-decagram' : ICONS.ASSESSMENT}
              size={moderateScale(18)}
              color={assessmentSubmitted ? COLORS.success : COLORS.accent}
            />
            <View style={styles.assessTexts}>
              <AppText
                style={[
                  styles.assessTitle,
                  { color: assessmentSubmitted ? COLORS.success : COLORS.accent },
                ]}
                numberOfLines={1}>
                {assessmentSubmitted ? 'Assessment submitted' : 'Assessment pending'}
              </AppText>
              <AppText style={styles.assessHint} numberOfLines={1}>
                {assessmentSubmitted
                  ? 'You can end this visit now.'
                  : `${entry.assessment.answered}/${entry.assessment.totalQuestions} scored — submit it to end this visit`}
              </AppText>
            </View>
            {assessmentSubmitted ? null : (
              <AppIcon
                name={ICONS.CHEVRON_RIGHT}
                size={moderateScale(18)}
                color={COLORS.gray500}
              />
            )}
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          {!arrived ? (
            <Button
              title="Mark as arrived"
              onPress={onArrive}
              loading={checkingArrival}
              variant="outline"
              style={styles.flexBtn}
            />
          ) : null}
          <Button
            title="End visit"
            onPress={confirmEnd}
            loading={ending}
            variant={mustAssess ? 'outline' : 'primary'}
            leftIcon={
              mustAssess ? (
                <AppIcon
                  name={ICONS.LOCK}
                  size={moderateScale(16)}
                  color={COLORS.primary}
                />
              ) : undefined
            }
            style={styles.flexBtn}
          />
        </View>
      </View>
    </View>
  );
};

export default AssessorVisitScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  centerText: { ...presets.bodySM, color: COLORS.gray600 },

  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    gap: spacing[4],
    backgroundColor: COLORS.white,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
    ...shadows.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: {
    width: scale(42),
    height: scale(42),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTexts: { flex: 1, gap: spacing[0.5] },
  name: { ...presets.labelLG, color: COLORS.gray900 },
  sub: { ...presets.caption, color: COLORS.gray500 },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimaryBg,
  },
  chipArrived: { backgroundColor: COLORS.success },
  chipText: { ...presets.labelSM, color: COLORS.primaryDark },
  chipTextArrived: { color: COLORS.white },
  actions: { flexDirection: 'row', gap: spacing[3] },
  flexBtn: { flex: 1 },

  assessStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    marginTop: -spacing[1],
  },
  assessPending: {
    borderColor: COLORS.accent,
    backgroundColor: addAlpha(COLORS.accent, 0.1),
  },
  assessDone: {
    borderColor: COLORS.success,
    backgroundColor: addAlpha(COLORS.success, 0.1),
  },
  assessPressed: { opacity: 0.75 },
  assessTexts: { flex: 1, gap: spacing[0.5] },
  assessTitle: { ...presets.labelSM },
  assessHint: { ...presets.caption, color: COLORS.gray600 },
});
