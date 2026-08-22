import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import {
  applyVisitUpdate,
  fetchMyFarmerVisitThunk,
  selectIncomingVisit,
  setIncomingVisit,
} from '../redux/slices/visitSlice';
import { mapVisit, type RawVisit } from '../api/visitApi';
import { isVisitTerminal } from '../types/visit';
import { connectSocket, getSocket, joinVisitRoom, leaveVisitRoom } from '../services/socket';
import { Env } from '../config/env';

const log = (...args: unknown[]): void => {
  if (Env.IS_DEV) {
    console.log('[farmerWatch]', ...args);
  }
};

export const useFarmerVisitWatch = (enabled: boolean = true): void => {
  const dispatch = useAppDispatch();
  const incoming = useAppSelector(selectIncomingVisit);
  const visitId = enabled ? incoming?.id : undefined;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let alive = true;

    const refresh = () => {
      if (alive) {
        dispatch(fetchMyFarmerVisitThunk());
      }
    };

    refresh();

    const onIncoming = (raw: unknown) => {
      if (alive && raw && typeof raw === 'object') {
        const v = mapVisit(raw as RawVisit);
        log('🔔 visit:incoming · assessor =', v.assessorName, '· id =', v.id);
        dispatch(setIncomingVisit(v));
      }
    };
    connectSocket()
      .then(socket => {
        if (!alive) {
          return;
        }
        socket.on('visit:incoming', onIncoming);
        socket.on('connect', refresh);
        if (socket.connected) {
          refresh();
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
      const s = getSocket();
      s?.off('visit:incoming', onIncoming);
      s?.off('connect', refresh);
    };
  }, [dispatch, enabled]);

  useEffect(() => {
    if (!visitId) {
      return;
    }
    let alive = true;
    const onUpdate = (raw: unknown) => {
      if (!alive || !raw || typeof raw !== 'object') {
        return;
      }
      const v = mapVisit(raw as RawVisit);
      log('⬇️ live update · status =', v.status, '· assessor pos =', v.assessorLat, v.assessorLng);
      if (isVisitTerminal(v.status)) {
        dispatch(setIncomingVisit(null));
      } else {
        dispatch(applyVisitUpdate(v));
      }
    };
    connectSocket()
      .then(socket => {
        if (!alive) {
          return;
        }
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
};
