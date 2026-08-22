import { useEffect } from 'react';
import { useAppDispatch } from '../redux/hooks';
import { fetchUnreadCountThunk } from '../redux/thunks/notificationThunks';
import { receiveNotification, setUnreadCount } from '../redux/slices/notificationSlice';
import { mapNotification, type RawNotification } from '../api/notificationApi';
import {
  invalidateTags,
  bumpSyncEpoch,
  setSocketConnected,
} from '../redux/slices/syncSlice';
import { tagsForSync, Tags, type SyncPayload } from '../redux/syncTags';
import { invalidateFieldSoil } from '../redux/slices/fieldDetailsSlice';
import { connectSocket, getSocket } from '../services/socket';

export const useRealtimeSync = (): void => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let alive = true;
    let hasConnected = false;

    dispatch(fetchUnreadCountThunk());

    const onSync = (raw: unknown) => {
      if (!alive || !raw || typeof raw !== 'object') {
        return;
      }
      const tags = tagsForSync(raw as SyncPayload);
      if (tags.length) {
        dispatch(invalidateTags(tags));
      }
    };

    const onNew = (raw: unknown) => {
      if (!alive || !raw || typeof raw !== 'object') {
        return;
      }
      const notification = mapNotification(raw as RawNotification);
      dispatch(receiveNotification(notification));
      dispatch(invalidateTags([Tags.notifications]));
      if (notification.type === 'enrolled_in_program') {
        dispatch(invalidateFieldSoil());
      }
    };

    const onUnreadCount = (raw: unknown) => {
      if (alive && raw && typeof raw === 'object' && 'count' in raw) {
        dispatch(setUnreadCount(Number((raw as { count: unknown }).count) || 0));
      }
    };

    const onConnect = () => {
      if (!alive) {
        return;
      }
      dispatch(setSocketConnected(true));
      if (hasConnected) {
        dispatch(bumpSyncEpoch());
        dispatch(fetchUnreadCountThunk());
      }
      hasConnected = true;
    };

    const onDisconnect = () => {
      if (alive) {
        dispatch(setSocketConnected(false));
      }
    };

    connectSocket()
      .then(socket => {
        if (!alive) {
          return;
        }
        socket.on('sync', onSync);
        socket.on('notification:new', onNew);
        socket.on('notification:unread_count', onUnreadCount);
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        if (socket.connected) {
          onConnect();
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
      const s = getSocket();
      s?.off('sync', onSync);
      s?.off('notification:new', onNew);
      s?.off('notification:unread_count', onUnreadCount);
      s?.off('connect', onConnect);
      s?.off('disconnect', onDisconnect);
    };
  }, [dispatch]);
};
