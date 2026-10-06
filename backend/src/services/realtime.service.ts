import logger from "../utils/logger.js";
import { getIO } from "../socket/index.js";

export type ChangedResource =
  | "enrollments"
  | "submissions"
  | "visits"
  | "assignments"
  | "dashboard"
  | "farms"
  | "fields"
  | "users"
  | "programs"
  | "organizations"
  | "eligibility"
  | "survey_questions"
  | "program_admin_survey"
  | "faqs"
  | "contact_enquiries"
  | "assessments"
  | "login_logs"
  | "email_settings";

// Writes often arrive in bursts. A message goes out once they pause, and never later than MAX_WAIT_MS after the first.
const QUIET_MS = 250;
const MAX_WAIT_MS = 1000;
const pendingForAdmins = new Map<ChangedResource, Record<string, unknown>>();
let adminTimer: ReturnType<typeof setTimeout> | null = null;
let firstPendingAt = 0;

function flushAdminChanges(): void {
  adminTimer = null;
  const batch = [...pendingForAdmins];
  pendingForAdmins.clear();
  try {
    const room = getIO().to("admins");
    for (const [resource, detail] of batch) {
      room.emit("data:changed", { resource, ...detail });
    }
  } catch {
    // socket not ready; ignore
  }
}

export function broadcastToAdmins(
  resource: ChangedResource,
  detail: Record<string, unknown> = {}
): void {
  const now = Date.now();
  if (pendingForAdmins.size === 0) firstPendingAt = now;
  pendingForAdmins.set(resource, { ...pendingForAdmins.get(resource), ...detail });
  if (adminTimer) clearTimeout(adminTimer);
  const wait = Math.max(0, Math.min(QUIET_MS, firstPendingAt + MAX_WAIT_MS - now));
  adminTimer = setTimeout(flushAdminChanges, wait);
  adminTimer.unref();
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

// What a producer's survey status page reacts to. Everything that moves their
// application forward is one of these.
export type ApplicationEvent =
  | "submission_scored"
  | "band_changed"
  | "contract_sent"
  | "contract_signed"
  | "enrolled"
  | "withdrawn";

/**
 * The standalone survey app has no account, so its status page joins a room by
 * submission id (resolved from the magic-link status token). Every application
 * change is sent here too, so that page updates live without a refresh.
 */
export function notifySubmission(
  submissionId: string,
  event: ApplicationEvent,
  detail: Record<string, unknown> = {}
): void {
  try {
    getIO()
      .to(`submission:${submissionId}`)
      .emit("application:changed", { event, ...detail });
  } catch (err) {
    logger.debug?.("notifySubmission failed", err);
  }
}

/**
 * Branding and contact details changed. Sent to everyone connected, signed in
 * or not, so the logo, favicon and contact page update without a refresh.
 */
export function broadcastConfigChanged(): void {
  try {
    getIO().emit("config:changed");
  } catch (err) {
    logger.debug?.("broadcastConfigChanged failed", err);
  }
}
