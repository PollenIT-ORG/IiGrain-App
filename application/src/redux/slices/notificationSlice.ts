import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AppNotification } from '../../types/notification';
import { logout } from './authSlice';
import {
  fetchNotificationsThunk,
  fetchMoreNotificationsThunk,
  fetchUnreadCountThunk,
  markNotificationReadThunk,
  markAllNotificationsReadThunk,
  deleteNotificationThunk,
  deleteNotificationsThunk,
  deleteAllNotificationsThunk,
} from '../thunks/notificationThunks';

export interface NotificationState {
  items: AppNotification[] | null;
  unreadCount: number;
  page: number;
  totalPages: number;
  total: number;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  markingId: string | null;
  markingAll: boolean;
  deletingIds: string[];
  deletingAll: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  items: null,
  unreadCount: 0,
  page: 1,
  totalPages: 1,
  total: 0,
  loading: false,
  refreshing: false,
  loadingMore: false,
  markingId: null,
  markingAll: false,
  deletingIds: [],
  deletingAll: false,
  error: null,
};

const removeByIds = (state: NotificationState, ids: readonly string[]): void => {
  if (!ids.length) {
    return;
  }
  const doomed = new Set(ids);
  const before = state.items?.length ?? 0;
  state.items = (state.items ?? []).filter(n => !doomed.has(n.id));
  state.total = Math.max(0, state.total - (before - state.items.length));
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotificationError(state) {
      state.error = null;
    },
    receiveNotification(state, action: PayloadAction<AppNotification>) {
      const incoming = action.payload;
      if (state.items?.some(n => n.id === incoming.id)) {
        return;
      }
      state.items = [incoming, ...(state.items ?? [])];
      state.total += 1;
      if (!incoming.read) {
        state.unreadCount += 1;
      }
    },
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchNotificationsThunk.pending, state => {
        state.loading = state.items === null;
        state.refreshing = state.items !== null;
        state.error = null;
      })
      .addCase(fetchNotificationsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.refreshing = false;
        state.items = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
        state.page = action.payload.page;
        state.totalPages = action.payload.totalPages;
        state.total = action.payload.total;
      })
      .addCase(fetchNotificationsThunk.rejected, (state, action) => {
        state.loading = false;
        state.refreshing = false;
        state.error = action.payload?.message ?? 'Failed to load notifications';
      })
      .addCase(fetchMoreNotificationsThunk.pending, state => {
        state.loadingMore = true;
      })
      .addCase(fetchMoreNotificationsThunk.fulfilled, (state, action) => {
        state.loadingMore = false;
        const existingIds = new Set((state.items ?? []).map(n => n.id));
        const fresh = action.payload.notifications.filter(n => !existingIds.has(n.id));
        state.items = [...(state.items ?? []), ...fresh];
        state.unreadCount = action.payload.unreadCount;
        state.page = action.payload.page;
        state.totalPages = action.payload.totalPages;
        state.total = action.payload.total;
      })
      .addCase(fetchMoreNotificationsThunk.rejected, state => {
        state.loadingMore = false;
      })
      .addCase(fetchUnreadCountThunk.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      .addCase(markNotificationReadThunk.pending, (state, action) => {
        state.markingId = action.meta.arg;
      })
      .addCase(markNotificationReadThunk.fulfilled, (state, action) => {
        state.markingId = null;
        const { id, unreadCount, missing } = action.payload;
        if (missing) {
          removeByIds(state, [id]);
          return;
        }
        if (unreadCount !== null) {
          state.unreadCount = unreadCount;
        }
        const item = state.items?.find(n => n.id === id);
        if (item && !item.read) {
          item.read = true;
          item.readAtISO = new Date().toISOString();
        }
      })
      .addCase(markNotificationReadThunk.rejected, state => {
        state.markingId = null;
      })
      .addCase(markAllNotificationsReadThunk.pending, state => {
        state.markingAll = true;
      })
      .addCase(markAllNotificationsReadThunk.fulfilled, state => {
        state.markingAll = false;
        state.unreadCount = 0;
        const now = new Date().toISOString();
        state.items = (state.items ?? []).map(n =>
          n.read ? n : { ...n, read: true, readAtISO: now },
        );
      })
      .addCase(markAllNotificationsReadThunk.rejected, state => {
        state.markingAll = false;
      })
      .addCase(deleteNotificationThunk.pending, (state, action) => {
        state.deletingIds.push(action.meta.arg);
      })
      .addCase(deleteNotificationThunk.fulfilled, (state, action) => {
        state.deletingIds = state.deletingIds.filter(id => !action.payload.ids.includes(id));
        removeByIds(state, action.payload.ids);
        if (action.payload.unreadCount !== null) {
          state.unreadCount = action.payload.unreadCount;
        }
      })
      .addCase(deleteNotificationThunk.rejected, (state, action) => {
        state.deletingIds = state.deletingIds.filter(id => id !== action.meta.arg);
      })
      .addCase(deleteNotificationsThunk.pending, (state, action) => {
        state.deletingIds.push(...action.meta.arg);
      })
      .addCase(deleteNotificationsThunk.fulfilled, (state, action) => {
        state.deletingIds = state.deletingIds.filter(id => !action.payload.ids.includes(id));
        removeByIds(state, action.payload.ids);
        if (action.payload.unreadCount !== null) {
          state.unreadCount = action.payload.unreadCount;
        }
      })
      .addCase(deleteNotificationsThunk.rejected, (state, action) => {
        const failed = new Set(action.meta.arg);
        state.deletingIds = state.deletingIds.filter(id => !failed.has(id));
      })
      .addCase(deleteAllNotificationsThunk.pending, state => {
        state.deletingAll = true;
      })
      .addCase(deleteAllNotificationsThunk.fulfilled, (state, action) => {
        state.deletingAll = false;
        state.items = [];
        state.total = 0;
        state.page = 1;
        state.totalPages = 1;
        state.unreadCount = action.payload.unreadCount ?? 0;
      })
      .addCase(deleteAllNotificationsThunk.rejected, state => {
        state.deletingAll = false;
      })
      .addCase(logout, () => initialState);
  },
});

export const { clearNotificationError, receiveNotification, setUnreadCount } =
  notificationSlice.actions;
export default notificationSlice.reducer;

export {
  fetchNotificationsThunk,
  fetchMoreNotificationsThunk,
  fetchUnreadCountThunk,
  markNotificationReadThunk,
  markAllNotificationsReadThunk,
  deleteNotificationThunk,
  deleteNotificationsThunk,
  deleteAllNotificationsThunk,
};

interface HasNotifications {
  notifications: NotificationState;
}

const EMPTY_ITEMS: AppNotification[] = [];

export const selectNotifications = (s: HasNotifications): AppNotification[] =>
  s.notifications.items ?? EMPTY_ITEMS;
export const selectNotificationsRaw = (s: HasNotifications): AppNotification[] | null =>
  s.notifications.items;
export const selectUnreadCount = (s: HasNotifications): number => s.notifications.unreadCount;
export const selectHasMoreNotifications = (s: HasNotifications): boolean =>
  s.notifications.page < s.notifications.totalPages;
export const selectNotificationsLoading = (s: HasNotifications): boolean =>
  s.notifications.loading;
export const selectNotificationsRefreshing = (s: HasNotifications): boolean =>
  s.notifications.refreshing;
export const selectNotificationsLoadingMore = (s: HasNotifications): boolean =>
  s.notifications.loadingMore;
export const selectNotificationsError = (s: HasNotifications): string | null =>
  s.notifications.error;
export const selectMarkingNotificationId = (s: HasNotifications): string | null =>
  s.notifications.markingId;
export const selectMarkingAllNotifications = (s: HasNotifications): boolean =>
  s.notifications.markingAll;
export const selectNotificationsPage = (s: HasNotifications): number => s.notifications.page;
export const selectDeletingNotificationIds = (s: HasNotifications): string[] =>
  s.notifications.deletingIds;
export const selectDeletingAllNotifications = (s: HasNotifications): boolean =>
  s.notifications.deletingAll;
export const selectNotificationsTotal = (s: HasNotifications): number => s.notifications.total;
