import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import { VisitMap } from '../../maps';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  arriveVisitThunk,
  endVisitThunk,
  selectActiveVisit,
  selectVisitEnding,
} from '../../redux/slices/visitSlice';
import type { AssessorScreenProps } from '../../navigation/navigationTypes';

const AssessorVisitScreen: React.FC<AssessorScreenProps<'AssessorVisit'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const visit = useAppSelector(selectActiveVisit);
  const ending = useAppSelector(selectVisitEnding);
  const visitId = visit?.id;

  useEffect(() => {
    if (visit && (visit.status === 'completed' || visit.status === 'cancelled')) {
      navigation.goBack();
    }
  }, [visit, navigation]);

  const onArrive = useCallback(() => {
    if (visitId) {
      dispatch(arriveVisitThunk(visitId));
    }
  }, [dispatch, visitId]);

  const confirmEnd = useCallback(() => {
    if (!visitId) {
      return;
    }
    Alert.alert('End visit', 'End this visit and stop sharing your location?', [
      { text: 'Keep tracking', style: 'cancel' },
      {
        text: 'End visit',
        style: 'destructive',
        onPress: () => {
          dispatch(endVisitThunk({ visitId, outcome: 'completed' })).finally(() =>
            navigation.goBack(),
          );
        },
      },
    ]);
  }, [dispatch, visitId, navigation]);

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
  const arrived = visit.status === 'arrived';
  const subtitle = [visit.farmName, visit.fieldName].filter(Boolean).join(' · ');

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Visit in progress" onBack={() => navigation.goBack()} />

      <VisitMap assessor={assessorPos} destination={destination} style={styles.map} />

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

        <View style={styles.actions}>
          {!arrived ? (
            <Button title="Mark as arrived" onPress={onArrive} variant="outline" style={styles.flexBtn} />
          ) : null}
          <Button title="End visit" onPress={confirmEnd} loading={ending} style={styles.flexBtn} />
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
});
