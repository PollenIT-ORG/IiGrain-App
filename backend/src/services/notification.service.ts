import logger from "../utils/logger.js";
import prisma from "../db/prisma.js";
import { getIO } from "../socket/index.js";
import { sendMail } from "./mailer.service.js";
import type { EmailContent } from "./emailTemplates.js";
import {
  createNotification,
  createNotificationsForUsers,
  listNotifications,
  countUnread,
  markRead,
  markAllRead,
  type NotificationType,
  type PublicNotification,
} from "../models/notification.model.js";

export interface Recipient {
  email: string;
  fullName: string | null;
}

/** Builds the email for one recipient, or returns null to skip sending. */
export type EmailFor = (r: Recipient) => EmailContent | null;

function pushToUser(userId: string, event: string, payload: unknown): void {
  try {
    getIO().to(`user:${userId}`).emit(event, payload);
  } catch {
    // socket not ready; ignore
  }
}

async function pushUnreadCount(userId: string): Promise<void> {
  try {
    const count = await countUnread(userId);
    pushToUser(userId, "notification:unread_count", { count });
  } catch (err) {
    logger.warn(`Failed to push unread count for ${userId}`, err);
  }
}

/** Looks up the recipients' addresses and mails each one. Never throws. */
async function mailRecipients(userIds: string[], emailFor: EmailFor): Promise<void> {
  try {
    const users = await prisma.users.findMany({
      where: { id: { in: userIds }, deleted_at: null, is_active: true },
      select: { email: true, full_name: true },
    });
    for (const u of users) {
      const content = emailFor({ email: u.email, fullName: u.full_name });
      if (!content) continue;
      void sendMail({
        to: u.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
    }
  } catch (err) {
    logger.error("Failed to send notification email", err);
  }
}

export interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
  /** Supply to also email the user. Omit for in-app only. */
  emailFor?: EmailFor;
}

export async function notifyUser(p: NotifyParams): Promise<void> {
  try {
    const notification = await createNotification(p);
    pushToUser(p.userId, "notification:new", notification);
    await pushUnreadCount(p.userId);
  } catch (err) {
    logger.error("Failed to create/push notification", err);
  }
  if (p.emailFor) await mailRecipients([p.userId], p.emailFor);
}

export async function notifyUsers(
  userIds: string[],
  n: Omit<NotifyParams, "userId">
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await createNotificationsForUsers(userIds, n);
    const payload = {
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      data: n.data ?? {},
    };
    for (const uid of userIds) {
      pushToUser(uid, "notification:new", payload);
      void pushUnreadCount(uid);
    }
  } catch (err) {
    logger.error("Failed to fan-out notifications", err);
  }
  if (n.emailFor) await mailRecipients(userIds, n.emailFor);
}

export interface ListInput {
  userId: string;
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

export async function getNotifications(input: ListInput): Promise<{
  notifications: PublicNotification[];
  unreadCount: number;
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { rows, total } = await listNotifications({
    userId: input.userId,
    unreadOnly: input.unreadOnly,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  });
  const unreadCount = await countUnread(input.userId);
  return {
    notifications: rows,
    unreadCount,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return countUnread(userId);
}

export async function readOne(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const changed = await markRead(notificationId, userId);
  if (changed) await pushUnreadCount(userId);
  return changed;
}

export async function readAll(userId: string): Promise<number> {
  const n = await markAllRead(userId);
  if (n > 0) await pushUnreadCount(userId);
  return n;
}
