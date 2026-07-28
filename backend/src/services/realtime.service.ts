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
  | "contact_enquiries";

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

// What the website producer's own screens react to. Everything that moves their
// application forward is one of these.
export type WebsiteEvent =
  | "submission_scored"
  | "band_changed"
  | "contract_sent"
  | "contract_signed"
  | "enrolled";

/**
 * Tells one website account that their application moved. Every device signed
 * in as that account is in the room, so the dashboard updates without a reload
 * no matter who made the change.
 */
export function notifyWebsiteUser(
  websiteUserId: string,
  event: WebsiteEvent,
  detail: Record<string, unknown> = {}
): void {
  try {
    getIO()
      .to(`website:${websiteUserId}`)
      .emit("application:changed", { event, ...detail });
  } catch (err) {
    logger.debug?.("notifyWebsiteUser failed", err);
  }
}

/**
 * The standalone survey app has no account, so its status page joins a room by
 * submission id (resolved from the magic-link status token). Every application
 * change is sent here too, so that page updates live without a refresh.
 */
export function notifySubmission(
  submissionId: string,
  event: WebsiteEvent,
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
