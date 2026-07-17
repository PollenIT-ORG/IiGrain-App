import { useEffect } from 'react';
import Geolocation from '@react-native-community/geolocation';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import {
  applyVisitUpdate,
  fetchMyAssessorVisitThunk,
  selectActiveVisit,
  setAssessorPosition,
} from '../redux/slices/visitSlice';
import { mapVisit, pushVisitLocation, type RawVisit } from '../api/visitApi';
import { connectSocket, getSocket, joinVisitRoom, leaveVisitRoom } from '../services/socket';
import { ensureLocationPermission, getCurrentLocation } from '../services/currentLocation';
import { showToast } from '../services/toastService';

export const useAssessorVisitStream = (): void => {
  const dispatch = useAppDispatch();
  const activeVisit = useAppSelector(selectActiveVisit);
  const visitId = activeVisit?.id;

  useEffect(() => {
    dispatch(fetchMyAssessorVisitThunk());
  }, [dispatch]);

  useEffect(() => {
    if (!visitId) {
      return;
    }
    let alive = true;
    const onUpdate = (raw: unknown) => {
      if (alive && raw && typeof raw === 'object') {
        const v = mapVisit(raw as RawVisit);
        console.log('[assessorStream] visit update · status =', v.status, '· pos =', v.assessorLat, v.assessorLng);
        dispatch(applyVisitUpdate(v));
      }
    };
    connectSocket()
      .then(socket => {
        if (!alive) {
          return;
        }
        console.log('[assessorStream] joining room visit:' + visitId);
        joinVisitRoom(visitId);
        socket.on('visit:status', onUpdate);
        socket.on('visit:location', onUpdate);
      })
      .catch(() => {});
    return () => {
      alive = false;
      leaveVisitRoom(visitId);
      const s = getSocket();
      s?.off('visit:status', onUpdate);
      s?.off('visit:location', onUpdate);
    };
  }, [visitId, dispatch]);

  useEffect(() => {
    if (!visitId) {
      return;
    }
    let watchId: number | null = null;
    let cancelled = false;

    const push = (lat: number, lng: number, source: string) => {
      dispatch(setAssessorPosition({ lat, lng }));
      const s = getSocket();
      if (s?.connected) {
        console.log(`[assessorStream] ${source} fix → emit visit:location`, lat.toFixed(6), lng.toFixed(6));
        s.emit(
          'visit:location',
          { visitId, lat, lng },
          (ack: { ok?: boolean; error?: string } | undefined) => {
            if (!ack?.ok) {
              console.log('[assessorStream] emit not ack-ok → REST fallback', ack?.error);
              pushVisitLocation(visitId, lat, lng).catch(() => {});
            }
          },
        );
      } else {
        console.log(`[assessorStream] ${source} fix → socket down, REST fallback`, lat.toFixed(6), lng.toFixed(6));
        pushVisitLocation(visitId, lat, lng).catch(() => {});
      }
    };

    (async () => {
      console.log('[assessorStream] visit live · id =', visitId, '· requesting location permission…');
      const ok = await ensureLocationPermission();
      if (cancelled) {
        return;
      }
      if (!ok) {
        console.log('[assessorStream] location permission denied');
        showToast('Location permission needed to share your live position.', { type: 'error' });
        return;
      }
      console.log('[assessorStream] permission granted · getting first fix…');
      try {
        const c = await getCurrentLocation();
        if (!cancelled) {
          push(c.latitude, c.longitude, 'seed');
        }
      } catch (e) {
        console.log('[assessorStream] seed fix failed (watch will deliver it)', e);
      }
      if (cancelled) {
        return;
      }
      console.log('[assessorStream] starting live watchPosition stream');
      watchId = Geolocation.watchPosition(
        pos => push(pos.coords.latitude, pos.coords.longitude, 'live'),
        err => console.log('[assessorStream] gps error', err.code, err.message),
        { enableHighAccuracy: true, distanceFilter: 5, interval: 3000, fastestInterval: 2000 },
      );
    })();

    return () => {
      cancelled = true;
      if (watchId != null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, [visitId, dispatch]);
};
