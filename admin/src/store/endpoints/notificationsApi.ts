import { apiSlice } from "../api";
import type { ApiSuccess, ApiPaged, PageMeta } from "../../types";

export interface NotificationRedirect {
  screen: string;
  fieldId?: string;
  programId?: string;
  enrollmentId?: string;
  visitId?: string;
  submissionId?: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  redirect?: NotificationRedirect;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

interface ListResponse {
  notifications: AppNotification[];
  unreadCount: number;
  meta?: PageMeta;
}

export const notificationsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listNotifications: build.query<ListResponse, { page?: number; limit?: number } | void>({
      query: (args) => ({
        url: "/notifications",
        method: "GET",
        params: { page: args?.page ?? 1, limit: args?.limit ?? 20 },
      }),
      transformResponse: (
        res: ApiPaged<{ notifications: AppNotification[]; unreadCount: number }>
      ) => ({
        notifications: res.data.notifications,
        unreadCount: res.data.unreadCount,
        meta: res.meta,
      }),
      providesTags: ["Notifications"],
    }),

    unreadCount: build.query<number, void>({
      query: () => ({ url: "/notifications/unread-count", method: "GET" }),
      transformResponse: (res: ApiSuccess<{ count: number }>) => res.data.count,
      providesTags: ["Notifications"],
    }),

    markNotificationRead: build.mutation<void, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: "PATCH" }),
      invalidatesTags: ["Notifications"],
    }),

    markAllNotificationsRead: build.mutation<void, void>({
      query: () => ({ url: "/notifications/read-all", method: "PATCH" }),
      invalidatesTags: ["Notifications"],
    }),

    deleteNotification: build.mutation<void, string>({
      query: (id) => ({ url: `/notifications/${id}`, method: "DELETE" }),
      invalidatesTags: ["Notifications"],
    }),

    deleteNotifications: build.mutation<void, string[]>({
      query: (ids) => ({
        url: "/notifications/delete",
        method: "POST",
        data: { ids },
      }),
      invalidatesTags: ["Notifications"],
    }),

    deleteAllNotifications: build.mutation<void, void>({
      query: () => ({ url: "/notifications", method: "DELETE" }),
      invalidatesTags: ["Notifications"],
    }),
  }),
});

export const {
  useListNotificationsQuery,
  useUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useDeleteNotificationsMutation,
  useDeleteAllNotificationsMutation,
} = notificationsApi;
