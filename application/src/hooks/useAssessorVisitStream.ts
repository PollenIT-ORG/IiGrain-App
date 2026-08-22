import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { Env } from '../config/env';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import {
  applyVisitUpdate,
  fetchMyAssessorVisitThunk,
  selectActiveVisit,
  setAssessorPosition,
} from '../redux/slices/visitSlice';
import { mapVisit, pushVisitLocation, type RawVisit } from '../api/visitApi';
import { connectSocket, getSocket, joinVisitRoom, leaveVisitRoom } from '../services/socket';
import {
  LocationError,
  ensureLocationPermission,
  getCurrentLocation,
  toCoords,
  type Coords,
} from '../services/currentLocation';
import { showToast } from '../services/toastService';

const STALE_FIX_MS = 20000;

const NAG_INTERVAL_MS = 60_000;

const MIN_SEND_INTERVAL_MS = 3_000;

const log = (...args: unknown[]): void => {
  if (Env.IS_DEV) {
    console.log('[assessorStream]', ...args);
  }
};

export const useAssessorVisitStream = (): void => {
  const dispatch = useAppDispatch();
  const activeVisit = useAppSelector(selectActiveVisit);
  const visitId = activeVisit?.id;

  useEffect(() => {
    let alive = true;

    const refresh = () => {
      if (alive) {
        dispatch(fetchMyAssessorVisitThunk());
      }
    };

    refresh();

    connectSocket()
      .then(socket => {
        if (!alive) {
          return;
        }
        socket.on('connect', refresh);
        if (socket.connected) {
          refresh();
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
      getSocket()?.off('connect', refresh);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!visitId) {
      return;
    }
    let alive = true;
    const onUpdate = (raw: unknown) => {
      if (alive && raw && typeof raw === 'object') {
        const v = mapVisit(raw as RawVisit);
        log('⬇️ visit update · status =', v.status, '· pos =', v.assessorLat, v.assessorLng);
        dispatch(applyVisitUpdate(v));
      }
    };
    connectSocket()
      .then(socket => {
        if (!alive) {
          return;
        }
        log('joining room visit:' + visitId);
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
    let poller: ReturnType<typeof setInterval> | null = null;
    let lastFixAt = Date.now();

    let lastSentAt = 0;

    const push = (coords: Coords, source: string) => {
      const { latitude: lat, longitude: lng } = coords;
      dispatch(setAssessorPosition({ lat, lng }));

      const now = Date.now();
      if (now - lastSentAt < MIN_SEND_INTERVAL_MS) {
        log(`📍 ${source} fix → throttled (server accepts 1 per ${MIN_SEND_INTERVAL_MS}ms)`);
        return;
      }
      lastSentAt = now;

      const report = {
        latitude: lat,
        longitude: lng,
        accuracyM: coords.accuracyM,
        isMock: coords.isMock,
      };

      const s = getSocket();
      if (s?.connected) {
        log(`📍 ${source} fix → emit visit:location`, lat.toFixed(6), lng.toFixed(6));
        s.emit(
          'visit:location',
          {
            visitId,
            lat,
            lng,
            accuracy_m: coords.accuracyM ?? undefined,
            is_mock: coords.isMock || undefined,
          },
          (ack: { ok?: boolean; error?: string } | undefined) => {
            if (!ack?.ok) {
              log('emit not ack-ok → REST fallback', ack?.error);
              pushVisitLocation(visitId, report).catch(() => {});
            }
          },
        );
      } else {
        log(`📍 ${source} fix → socket down, REST fallback`, lat.toFixed(6), lng.toFixed(6));
        pushVisitLocation(visitId, report).catch(() => {});
      }
    };

    let lastNagAt = 0;
    const nag = (message: string) => {
      const now = Date.now();
      if (now - lastNagAt < NAG_INTERVAL_MS) {
        return;
      }
      lastNagAt = now;
      showToast(message, { type: 'error' });
    };

    const messageFor = (error: unknown): string => {
      const code = error instanceof LocationError ? error.code : null;
      switch (code) {
        case 'permission_denied':
        case 'permission_blocked':
          return 'Location permission is off — the farmer cannot see you moving.';
        case 'location_services_disabled':
          return 'Turn on your device location — live tracking has stopped.';
        default:
          return 'Cannot get a GPS fix — live tracking has paused.';
      }
    };

    const seed = async (source: string) => {
      try {
        const c = await getCurrentLocation();
        if (!cancelled) {
          lastFixAt = Date.now();
          push(c, source);
        }
        return true;
      } catch (error) {
        log('fix failed ·', source, error);
        if (!cancelled) {
          nag(messageFor(error));
        }
        return false;
      }
    };

    const startWatch = () => {
      if (cancelled) {
        return;
      }
      if (watchId != null) {
        Geolocation.clearWatch(watchId);
      }
      log('▶️ starting live watchPosition stream');
      watchId = Geolocation.watchPosition(
        pos => {
          lastFixAt = Date.now();
          push(toCoords(pos), 'live');
        },
        err => log('⚠️ gps error', err.code, err.message),
        {
          enableHighAccuracy: true,
          distanceFilter: 0,
          interval: 5000,
          fastestInterval: 3000,
        },
      );
    };

    (async () => {
      log('visit live · id =', visitId, '· requesting location permission…');
      const ok = await ensureLocationPermission();
      if (cancelled) {
        return;
      }
      if (!ok) {
        nag('Location permission needed to share your live position.');
      }
      await seed('seed');
      startWatch();

      poller = setInterval(() => {
        if (cancelled || Date.now() - lastFixAt < STALE_FIX_MS) {
          return;
        }
        log('watch went quiet · taking a one-shot fix');
        seed('watchdog').then(recovered => {
          if (recovered && !cancelled) {
            startWatch();
          }
        });
      }, STALE_FIX_MS);
    })();

    const onAppState = (state: AppStateStatus) => {
      if (state !== 'active' || cancelled) {
        return;
      }
      log('app foregrounded · re-seeding stream');
      seed('foreground').then(ok => {
        if (ok) {
          startWatch();
        }
      });
    };
    const appStateSub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      appStateSub.remove();
      if (watchId != null) {
        Geolocation.clearWatch(watchId);
      }
      if (poller != null) {
        clearInterval(poller);
      }
    };
  }, [visitId, dispatch]);
};
