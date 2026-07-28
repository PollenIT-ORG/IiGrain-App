import { createAsyncThunk } from '@reduxjs/toolkit';
import * as notificationApi from '../../api/notificationApi';
import type { GetNotificationsParams } from '../../api/notificationApi';
import type { NotificationsPage } from '../../types/notification';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

type ThunkConfig = { rejectValue: StandardizedError };

export const fetchNotificationsThunk = createAsyncThunk<
  NotificationsPage,
  GetNotificationsParams | undefined,
  ThunkConfig
>('notifications/fetch', async (params, { rejectWithValue }) => {
  try {
    return await notificationApi.getNotifications(params);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchMoreNotificationsThunk = createAsyncThunk<
  NotificationsPage,
  number,
  ThunkConfig
>('notifications/fetchMore', async (page, { rejectWithValue }) => {
  try {
    return await notificationApi.getNotifications({ page });
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchUnreadCountThunk = createAsyncThunk<number, void, ThunkConfig>(
  'notifications/fetchUnreadCount',
  async (_arg, { rejectWithValue }) => {
    try {
      return await notificationApi.getUnreadCount();
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const markNotificationReadThunk = createAsyncThunk<
  { id: string; unreadCount: number | null; missing: boolean },
  string,
  ThunkConfig
>('notifications/markRead', async (id, { rejectWithValue }) => {
  try {
    const unreadCount = await notificationApi.markNotificationRead(id);
    return { id, unreadCount, missing: false };
  } catch (error) {
    const standardized = handleApiError(error);
    // The notification was deleted (or was never ours). Not an error the user
    // can act on — resolve quietly and let the reducer drop the stale row.
    if (standardized.kind === 'notFound') {
      return { id, unreadCount: null, missing: true };
    }
    return rejectWithValue(standardized);
  }
});

export const markAllNotificationsReadThunk = createAsyncThunk<
  { updated: number; unreadCount: number },
  void,
  ThunkConfig
>('notifications/markAllRead', async (_arg, { rejectWithValue }) => {
  try {
    return await notificationApi.markAllNotificationsRead();
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

/** `unreadCount: null` means the server did not report one — keep the current value. */
export interface NotificationsRemoved {
  ids: string[];
  unreadCount: number | null;
}

export const deleteNotificationThunk = createAsyncThunk<NotificationsRemoved, string, ThunkConfig>(
  'notifications/delete',
  async (id, { rejectWithValue }) => {
    try {
      const unreadCount = await notificationApi.deleteNotification(id);
      return { ids: [id], unreadCount };
    } catch (error) {
      const standardized = handleApiError(error);
      // Already gone server-side — treat as done so the row leaves the list
      // instead of stranding the user with an error they cannot act on.
      if (standardized.kind === 'notFound') {
        return { ids: [id], unreadCount: null };
      }
      return rejectWithValue(standardized);
    }
  },
);

export const deleteNotificationsThunk = createAsyncThunk<
  NotificationsRemoved,
  string[],
  ThunkConfig
>('notifications/deleteMany', async (ids, { rejectWithValue }) => {
  try {
    const { unreadCount } = await notificationApi.deleteNotifications(ids);
    return { ids, unreadCount };
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const deleteAllNotificationsThunk = createAsyncThunk<
  { deleted: number; unreadCount: number },
  void,
  ThunkConfig
>('notifications/deleteAll', async (_arg, { rejectWithValue }) => {
  try {
    return await notificationApi.deleteAllNotifications();
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});
