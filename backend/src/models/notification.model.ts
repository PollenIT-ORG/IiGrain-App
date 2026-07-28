import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";

export type NotificationType =
  | "new_program_available"
  | "enrolled_in_program"
  | "assessor_assigned"
  | "assessor_visit_started"
  | "assessment_submitted"
  // Admin-facing: the eligibility survey flow.
  | "survey_submitted"
  | "contract_signed";

// Where the mobile app should navigate when this notification is tapped. `screen`
// is a stable key the RN app maps to a screen; the id fields are the nav params.
export interface NotificationRedirect {
  screen: string;
  fieldId?: string;
  programId?: string;
  enrollmentId?: string;
  visitId?: string;
  submissionId?: string;
}

// Fallback screen per type when a notification did not store an explicit `screen`.
const DEFAULT_SCREEN: Record<string, string> = {
  new_program_available: "available_programs",
  enrolled_in_program: "my_assessments",
  assessor_assigned: "my_assessments",
  assessor_visit_started: "visit_tracking",
  assessment_submitted: "assessment_history",
  // Admin panel routes (used by the web notification dropdown, not the app).
  survey_submitted: "eligibility",
  contract_signed: "eligibility",
};

export function notificationRedirect(
  type: string,
  data: Record<string, unknown>
): NotificationRedirect {
  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v.length > 0 ? v : undefined;
  const redirect: NotificationRedirect = {
    screen: str(data.screen) ?? DEFAULT_SCREEN[type] ?? "notifications",
  };
  const fieldId = str(data.fieldId);
  const programId = str(data.programId);
  const enrollmentId = str(data.enrollmentId);
  const visitId = str(data.visitId);
  const submissionId = str(data.submissionId);
  if (fieldId) redirect.fieldId = fieldId;
  if (programId) redirect.programId = programId;
  if (enrollmentId) redirect.enrollmentId = enrollmentId;
  if (visitId) redirect.visitId = visitId;
  if (submissionId) redirect.submissionId = submissionId;
  return redirect;
}

export interface PublicNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  redirect: NotificationRedirect;
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
  const data = (n.data as Record<string, unknown>) ?? {};
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data,
    redirect: notificationRedirect(n.type, data),
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

// "not_found" means the notification does not exist or belongs to someone else.
// "ok" covers both a fresh mark and one that was already read, so re-reading is
// idempotent rather than a 404.
export async function markRead(
  notificationId: string,
  userId: string
): Promise<"ok" | "not_found"> {
  const notif = await prisma.notifications.findFirst({
    where: { id: notificationId, user_id: userId, deleted_at: null },
    select: { id: true, read_at: true },
  });
  if (!notif) return "not_found";
  if (!notif.read_at) {
    await prisma.notifications.update({
      where: { id: notif.id },
      data: { read_at: new Date(), updated_at: new Date() },
    });
  }
  return "ok";
}

export async function markAllRead(userId: string): Promise<number> {
  const { count } = await prisma.notifications.updateMany({
    where: { user_id: userId, deleted_at: null, read_at: null },
    data: { read_at: new Date(), updated_at: new Date() },
  });
  return count;
}

// Soft-deletes one notification. Returns false if it does not exist or belongs
// to another user.
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const { count } = await prisma.notifications.updateMany({
    where: { id: notificationId, user_id: userId, deleted_at: null },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  return count > 0;
}

// Soft-deletes the given notifications that belong to the user. Returns how many
// were actually deleted.
export async function deleteNotifications(
  ids: string[],
  userId: string
): Promise<number> {
  if (ids.length === 0) return 0;
  const { count } = await prisma.notifications.updateMany({
    where: { id: { in: ids }, user_id: userId, deleted_at: null },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  return count;
}

// Soft-deletes every notification for the user. Returns how many were deleted.
export async function deleteAllNotifications(userId: string): Promise<number> {
  const { count } = await prisma.notifications.updateMany({
    where: { user_id: userId, deleted_at: null },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  return count;
}
