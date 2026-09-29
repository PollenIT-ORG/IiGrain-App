import { getIO } from "./index.js";
import logger from "../utils/logger.js";

// Live multi-device sync. Every device logged in as the same user is in the
// room "user:<id>" (see socket/index.ts). When that user's data changes on one
// device, we emit a single "sync" event to the room so their other devices can
// refresh the affected screen and stay live.

export type SyncResource =
  | "assessment"
  | "field"
  | "farm"
  | "soil"
  | "enrollment"
  | "document";

export type SyncAction =
  | "answer_saved"
  | "submitted"
  | "reviewed"
  | "discarded"
  | "created"
  | "updated"
  | "deleted"
  | "reset"
  | "enrolled"
  | "unenrolled";

export interface SyncPayload {
  resource: SyncResource;
  action: SyncAction;
  programId?: string;
  fieldId?: string;
  farmId?: string;
  categoryId?: string;
  questionId?: string;
  enrollmentId?: string;
  // The id of the device/socket that triggered the change, if known, so a client
  // can ignore its own echo. Optional; clients may simply refetch either way.
  originId?: string;
}

// Emits a sync event to every device of a single user. Never throws - if the
// socket server is not ready the change simply is not broadcast.
export function emitSync(userId: string, payload: SyncPayload): void {
  if (!userId) return;
  try {
    getIO().to(`user:${userId}`).emit("sync", payload);
  } catch {
    logger.debug?.("emitSync skipped: socket not ready");
  }
}
