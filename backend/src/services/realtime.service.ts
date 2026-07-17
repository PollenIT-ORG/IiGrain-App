import logger from "../utils/logger.js";
import { getIO } from "../socket/index.js";

export type ChangedResource =
  | "enrollments"
  | "submissions"
  | "visits"
  | "assignments"
  | "dashboard";

export function broadcastToAdmins(
  resource: ChangedResource,
  detail: Record<string, unknown> = {}
): void {
  try {
    getIO().to("admins").emit("data:changed", { resource, ...detail });
  } catch {
    // socket not ready; ignore
  }
}

export function broadcastToUsers(
  userIds: string[],
  resource: ChangedResource,
  detail: Record<string, unknown> = {}
): void {
  try {
    const io = getIO();
    for (const uid of userIds) {
      io.to(`user:${uid}`).emit("data:changed", { resource, ...detail });
    }
  } catch (err) {
    logger.debug?.("broadcastToUsers failed", err);
  }
}
