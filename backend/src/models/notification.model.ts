import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";

export type NotificationType =
  | "new_program_available"
  | "enrolled_in_program"
  | "assessor_assigned"
  | "assessor_visit_started"
  | "assessment_submitted";

export interface PublicNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

const SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  data: true,
  read_at: true,
  created_at: true,
} satisfies Prisma.notificationsSelect;

type Row = Prisma.notificationsGetPayload<{ select: typeof SELECT }>;

export function toPublic(n: Row): PublicNotification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: (n.data as Record<string, unknown>) ?? {},
    read: n.read_at !== null,
    read_at: n.read_at ? n.read_at.toISOString() : null,
    created_at: n.created_at.toISOString(),
  };
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
}

export async function createNotification(
  p: CreateNotificationParams
): Promise<PublicNotification> {
  const created = await prisma.notifications.create({
    data: {
      user_id: p.userId,
      type: p.type,
      title: p.title,
      body: p.body ?? null,
      data: (p.data ?? {}) as Prisma.InputJsonValue,
    },
    select: SELECT,
  });
  return toPublic(created);
}

export async function createNotificationsForUsers(
  userIds: string[],
  n: Omit<CreateNotificationParams, "userId">
): Promise<number> {
  if (userIds.length === 0) return 0;
  const { count } = await prisma.notifications.createMany({
    data: userIds.map((uid) => ({
      user_id: uid,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      data: (n.data ?? {}) as Prisma.InputJsonValue,
    })),
  });
  return count;
}

export interface ListNotificationsParams {
  userId: string;
  unreadOnly?: boolean;
  limit: number;
  offset: number;
}

export async function listNotifications(
  p: ListNotificationsParams
): Promise<{ rows: PublicNotification[]; total: number }> {
  const where: Prisma.notificationsWhereInput = {
    user_id: p.userId,
    deleted_at: null,
    ...(p.unreadOnly ? { read_at: null } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.notifications.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: p.limit,
      skip: p.offset,
      select: SELECT,
    }),
    prisma.notifications.count({ where }),
  ]);
  return { rows: rows.map(toPublic), total };
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notifications.count({
    where: { user_id: userId, deleted_at: null, read_at: null },
  });
}

export async function markRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const { count } = await prisma.notifications.updateMany({
    where: { id: notificationId, user_id: userId, deleted_at: null, read_at: null },
    data: { read_at: new Date(), updated_at: new Date() },
  });
  return count > 0;
}

export async function markAllRead(userId: string): Promise<number> {
  const { count } = await prisma.notifications.updateMany({
    where: { user_id: userId, deleted_at: null, read_at: null },
    data: { read_at: new Date(), updated_at: new Date() },
  });
  return count;
}
