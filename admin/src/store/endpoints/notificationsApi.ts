import { apiSlice } from "../api";
import type { ApiSuccess } from "../../types";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

interface ListResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export const notificationsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listNotifications: build.query<ListResponse, { page?: number; limit?: number } | void>({
      query: (args) => ({
        url: "/notifications",
        method: "GET",
        params: { page: args?.page ?? 1, limit: args?.limit ?? 20 },
      }),
      transformResponse: (res: ApiSuccess<ListResponse>) => res.data,
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
  }),
});

export const {
  useListNotificationsQuery,
  useUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;
