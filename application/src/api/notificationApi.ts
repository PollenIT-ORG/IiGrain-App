import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type {
  AppNotification,
  NotificationRedirect,
  NotificationsPage,
} from '../types/notification';

interface Envelope<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

interface RawNotificationRedirect {
  screen?: string;
  fieldId?: string | null;
  programId?: string | null;
  enrollmentId?: string | null;
  visitId?: string | null;
}

interface RawNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  redirect?: RawNotificationRedirect;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

interface RawNotificationsPayload {
  unreadCount: number;
  notifications: RawNotification[];
}

interface RawUnreadCountPayload {
  count: number;
}

interface RawMarkReadPayload {
  unreadCount: number;
}

interface RawMarkAllReadPayload {
  updated: number;
  unreadCount: number;
}

interface RawDeletePayload {
  deleted: number;
  unreadCount: number;
}

const mapRedirect = (
  raw: RawNotificationRedirect | undefined,
): NotificationRedirect => ({
  screen: raw?.screen ?? 'notifications',
  fieldId: raw?.fieldId ?? undefined,
  programId: raw?.programId ?? undefined,
  enrollmentId: raw?.enrollmentId ?? undefined,
  visitId: raw?.visitId ?? undefined,
});

const mapNotification = (raw: RawNotification): AppNotification => ({
  id: raw.id,
  type: raw.type,
  title: raw.title ?? '',
  body: raw.body,
  data: raw.data ?? {},
  redirect: mapRedirect(raw.redirect),
  read: !!raw.read,
  readAtISO: raw.read_at,
  createdAtISO: raw.created_at,
});

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export const getNotifications = async (
  params?: GetNotificationsParams,
): Promise<NotificationsPage> => {
  const res = await http.get<Envelope<RawNotificationsPayload>>(Endpoints.notifications.list, {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      unreadOnly: params?.unreadOnly ? 'true' : undefined,
    },
  });
  const payload = res.data.data;
  const meta = res.data.meta;
  return {
    notifications: (payload.notifications ?? []).map(mapNotification),
    unreadCount: payload.unreadCount ?? 0,
    page: meta?.page ?? params?.page ?? 1,
    totalPages: meta?.totalPages ?? 1,
    total: meta?.total ?? payload.notifications?.length ?? 0,
  };
};

export const getUnreadCount = async (): Promise<number> => {
  const res = await http.get<Envelope<RawUnreadCountPayload>>(
    Endpoints.notifications.unreadCount,
  );
  return res.data.data.count ?? 0;
};

/**
 * `silent` on purpose: marking read is a background side effect of tapping a
 * row. A stale id (already deleted, or never the user's) now answers 404, and
 * the user must not get an error modal for it — the thunk drops the row
 * instead. See the mobile-api-changes README.
 */
export const markNotificationRead = async (id: string): Promise<number> => {
  const res = await http.patch<Envelope<RawMarkReadPayload>>(
    Endpoints.notifications.markRead(id),
    undefined,
    { silent: true },
  );
  return res.data.data.unreadCount ?? 0;
};

export const markAllNotificationsRead = async (): Promise<RawMarkAllReadPayload> => {
  const res = await http.patch<Envelope<RawMarkAllReadPayload>>(
    Endpoints.notifications.markAllRead,
  );
  return res.data.data;
};

/** Deletes one notification. Returns the server's new unread total. */
export const deleteNotification = async (id: string): Promise<number> => {
  const res = await http.delete<Envelope<RawMarkReadPayload>>(
    Endpoints.notifications.remove(id),
  );
  return res.data.data?.unreadCount ?? 0;
};

/** Deletes the selected notifications. Returns how many went, plus the new unread total. */
export const deleteNotifications = async (ids: string[]): Promise<RawDeletePayload> => {
  const res = await http.post<Envelope<RawDeletePayload>>(Endpoints.notifications.removeMany, {
    ids,
  });
  return {
    deleted: res.data.data?.deleted ?? ids.length,
    unreadCount: res.data.data?.unreadCount ?? 0,
  };
};

/** Deletes every notification the user has. */
export const deleteAllNotifications = async (): Promise<RawDeletePayload> => {
  const res = await http.delete<Envelope<RawDeletePayload>>(Endpoints.notifications.removeAll);
  return {
    deleted: res.data.data?.deleted ?? 0,
    unreadCount: res.data.data?.unreadCount ?? 0,
  };
};

export { mapNotification };
export type { RawNotification };
