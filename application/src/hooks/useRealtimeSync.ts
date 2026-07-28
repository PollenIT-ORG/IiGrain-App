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

/**
 * The app's single realtime owner. Mount it exactly once, above the navigators.
 *
 * One Socket.IO connection carries all three server channels:
 *   `sync`                      -> cache invalidation, so every screen stays live
 *   `notification:new`          -> the bell list
 *   `notification:unread_count` -> the bell badge
 *
 * Nothing here patches domain state from a payload. `sync` only bumps cache
 * tags; the screen that owns the data refetches it (see `useSyncedFetch`). That
 * keeps the server as the single source of truth and means a payload shape
 * change can never corrupt the store.
 */
export const useRealtimeSync = (): void => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let alive = true;
    // Tracks the FIRST connect so we do not invalidate everything at startup —
    // screens are about to load anyway. Only a genuine reconnect needs catch-up.
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
      // Enrolling unlocks the soil nutrient inputs server-side, so any cached
      // soil tab is showing a stale lock. Kept alongside the `sync` enrollment
      // tag because the field-details buckets are not tag-driven.
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
        // `sync` is fire-and-forget, so anything emitted while we were offline
        // is gone. Invalidate everything once; each screen refetches on focus.
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
