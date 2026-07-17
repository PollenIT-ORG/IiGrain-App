import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import VisitMap from '../../components/location/VisitMap';
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
  applyVisitUpdate,
  selectIncomingVisit,
  setIncomingVisit,
} from '../../redux/slices/visitSlice';
import {
  getMyFarmerVisit,
  getVisit,
  mapVisit,
  type RawVisit,
} from '../../api/visitApi';
import { connectSocket, getSocket, joinVisitRoom, leaveVisitRoom } from '../../services/socket';
import type { Visit, VisitOutcome } from '../../types/visit';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const FarmerVisitTrackingScreen: React.FC<AppScreenProps<'FarmerVisitTracking'>> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const reduxVisit = useAppSelector(selectIncomingVisit);
  const routeVisitId = route.params?.visitId;

  const [visit, setVisit] = useState<Visit | null>(reduxVisit);
  const [ended, setEnded] = useState<VisitOutcome | null>(null);
  const visitId = visit?.id ?? routeVisitId;

  useEffect(() => {
    if (reduxVisit) {
      setVisit(reduxVisit);
    }
  }, [reduxVisit]);

  useEffect(() => {
    if (visit) {
      return;
    }
    let alive = true;
    (async () => {
      const v = routeVisitId ? await getVisit(routeVisitId) : await getMyFarmerVisit();
      if (alive && v) {
        setVisit(v);
        dispatch(setIncomingVisit(v));
      }
    })();
    return () => {
      alive = false;
    };
  }, [visit, routeVisitId, dispatch]);

  useEffect(() => {
    if (!visitId) {
      return;
    }
    let alive = true;
    const onLocation = (raw: unknown) => {
      if (alive && raw && typeof raw === 'object') {
        const v = mapVisit(raw as RawVisit);
        setVisit(v);
        dispatch(applyVisitUpdate(v));
      }
    };
    const onStatus = (raw: unknown) => {
      if (!alive || !raw || typeof raw !== 'object') {
        return;
      }
      const v = mapVisit(raw as RawVisit);
      setVisit(v);
      dispatch(applyVisitUpdate(v));
      if (v.status === 'completed' || v.status === 'cancelled') {
        setEnded(v.status);
      }
    };
    connectSocket()
      .then(socket => {
        if (!alive) {
          return;
        }
        joinVisitRoom(visitId);
        socket.on('visit:location', onLocation);
        socket.on('visit:status', onStatus);
      })
      .catch(() => {});
    return () => {
      alive = false;
      leaveVisitRoom(visitId);
      const s = getSocket();
      s?.off('visit:location', onLocation);
      s?.off('visit:status', onStatus);
    };
  }, [visitId, dispatch]);

  if (!visit) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Live tracking" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
          <AppText style={styles.centerText}>Connecting to your assessor…</AppText>
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
  const completed = ended === 'completed';

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Live tracking" onBack={() => navigation.goBack()} />

      <VisitMap assessor={assessorPos} destination={destination} style={styles.map} />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
        {ended ? (
          <>
            <View style={styles.row}>
              <View style={[styles.avatar, completed ? styles.avatarDone : styles.avatarCancel]}>
                <AppIcon
                  name={completed ? 'check-circle' : 'close-circle'}
                  size={moderateScale(24)}
                  color={COLORS.white}
                />
              </View>
              <View style={styles.rowTexts}>
                <AppText style={styles.name} numberOfLines={1}>
                  {completed ? 'Visit completed' : 'Visit cancelled'}
                </AppText>
                <AppText style={styles.sub} numberOfLines={2}>
                  {completed
                    ? `${visit.assessorName} has finished the visit to your farm.`
                    : `${visit.assessorName} called off the visit.`}
                </AppText>
              </View>
            </View>
            <Button title="Done" onPress={() => navigation.goBack()} style={styles.doneBtn} />
          </>
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.avatar}>
                <AppIcon name="account" size={moderateScale(22)} color={COLORS.primary} />
              </View>
              <View style={styles.rowTexts}>
                <AppText style={styles.name} numberOfLines={1}>
                  {visit.assessorName}
                </AppText>
                <AppText style={styles.sub} numberOfLines={1}>
                  {subtitle || 'Your assessor'}
                </AppText>
              </View>
              <View style={[styles.chip, arrived && styles.chipArrived]}>
                <AppText style={[styles.chipText, arrived && styles.chipTextArrived]}>
                  {arrived ? 'Arrived' : 'En route'}
                </AppText>
              </View>
            </View>
            <AppText style={styles.hint} numberOfLines={2}>
              {arrived
                ? 'Your assessor has reached your farm.'
                : 'Your assessor is on the way - the map updates live.'}
            </AppText>
          </>
        )}
      </View>
    </View>
  );
};

export default FarmerVisitTrackingScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  centerText: { ...presets.bodySM, color: COLORS.gray600 },

  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    gap: spacing[3],
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
  avatarDone: { backgroundColor: COLORS.success },
  avatarCancel: { backgroundColor: COLORS.gray500 },
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
  hint: { ...presets.caption, color: COLORS.gray500 },
  doneBtn: { marginTop: spacing[1] },
});
