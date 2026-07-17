import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as service from "../services/notification.service.js";
import type { ListNotificationsQuery } from "../validators/notification.schema.js";

function userId(req: { user?: { sub: string } }): string {
  if (!req.user) throw ApiError.unauthorized("Authentication required.");
  return req.user.sub;
}

export const listNotifications = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListNotificationsQuery;
  const result = await service.getNotifications({
    userId: userId(req),
    page: q.page,
    limit: q.limit,
    unreadOnly: q.unreadOnly,
  });
  return ApiResponse.send(
    res,
    200,
    "Notifications fetched.",
    { notifications: result.notifications, unreadCount: result.unreadCount },
    result.meta
  );
});

export const unreadCount = asyncHandler(async (req, res) => {
  const count = await service.getUnreadCount(userId(req));
  return ApiResponse.send(res, 200, "Unread count fetched.", { count });
});

export const markRead = asyncHandler(async (req, res) => {
  await service.readOne(req.params.id, userId(req));
  const count = await service.getUnreadCount(userId(req));
  return ApiResponse.send(res, 200, "Notification marked read.", { unreadCount: count });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const updated = await service.readAll(userId(req));
  return ApiResponse.send(res, 200, "All notifications marked read.", {
    updated,
    unreadCount: 0,
  });
});
