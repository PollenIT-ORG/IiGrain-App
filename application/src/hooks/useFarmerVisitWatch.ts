import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import {
  applyVisitUpdate,
  fetchMyFarmerVisitThunk,
  selectIncomingVisit,
  setIncomingVisit,
} from '../redux/slices/visitSlice';
import { mapVisit, type RawVisit } from '../api/visitApi';
import { connectSocket, getSocket, joinVisitRoom, leaveVisitRoom } from '../services/socket';

export const useFarmerVisitWatch = (): void => {
  const dispatch = useAppDispatch();
  const incoming = useAppSelector(selectIncomingVisit);
  const visitId = incoming?.id;

  useEffect(() => {
    let alive = true;
    dispatch(fetchMyFarmerVisitThunk());

    const onIncoming = (raw: unknown) => {
      if (alive && raw && typeof raw === 'object') {
        const v = mapVisit(raw as RawVisit);
        console.log('[farmerWatch] 🔔 visit:incoming · assessor =', v.assessorName, '· id =', v.id);
        dispatch(setIncomingVisit(v));
      }
    };
    connectSocket()
      .then(socket => {
        if (alive) {
          socket.on('visit:incoming', onIncoming);
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
      getSocket()?.off('visit:incoming', onIncoming);
    };
  }, [dispatch]);

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
      console.log('[farmerWatch] ⬇️ live update · status =', v.status, '· assessor pos =', v.assessorLat, v.assessorLng);
      if (v.status === 'completed' || v.status === 'cancelled') {
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
