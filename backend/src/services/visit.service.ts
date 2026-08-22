import ApiError from "../utils/ApiError.js";
import prisma from "../db/prisma.js";
import env from "../config/env.js";
import { haversineMeters, distanceToPolygonMeters } from "../utils/geo.js";
import { assertAssessmentWritable } from "./assessmentMobile.service.js";
import { notifyUser } from "./notification.service.js";
import { broadcastToAdmins } from "./realtime.service.js";
import { emitSync } from "../socket/liveSync.js";
import { visitStartedEmail } from "./emailTemplates.js";
import {
  findFieldWithFarmer,
  resolveAssessorProgramForField,
} from "../models/assessmentMobile.model.js";
import {
  createVisit,
  endVisit,
  markVisitArrived,
  updateVisitLocation,
  findActiveVisitForAssessor,
  findActiveVisitForFarmer,
  findVisitById,
  listBoardVisits,
  getLastVisitLocationRow,
  insertVisitLocation,
  flagVisitLocation,
  getVisitTrack as getVisitTrackRows,
  autoCloseAbandonedVisits,
  deleteOldVisitLocations,
  type PublicVisit,
  type TrackPoint,
} from "../models/visit.model.js";
import type { GeoJSONPolygon } from "../models/field.model.js";

// Centroid of a GeoJSON Polygon's outer ring, or null if it is not usable. Same
// formula the mobile map uses, so both sides agree on where the field centre is.
function polygonCentroid(
  polygon: GeoJSONPolygon | null
): { lat: number; lng: number } | null {
  const ring = polygon?.type === "Polygon" ? polygon.coordinates?.[0] : null;
  if (!Array.isArray(ring) || ring.length < 4) return null;

  // Drop the closing point so it is not counted twice.
  const pts = ring.slice(0, -1);

  let twiceArea = 0;
  let lat = 0;
  let lng = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    lng += (x1 + x2) * cross;
    lat += (y1 + y2) * cross;
  }

  // Degenerate ring (zero area) - fall back to the average of the vertices.
  if (twiceArea === 0) {
    const n = pts.length;
    return {
      lat: pts.reduce((s, p) => s + p[1], 0) / n,
      lng: pts.reduce((s, p) => s + p[0], 0) / n,
    };
  }

  const factor = 1 / (3 * twiceArea);
  return { lat: lat * factor, lng: lng * factor };
}

async function fieldDestination(
  fieldId: string
): Promise<{ lat: number | null; lng: number | null }> {
  const f = await prisma.fields.findFirst({
    where: { id: fieldId, deleted_at: null },
    select: { latitude: true, longitude: true, boundary: true },
  });
  if (!f) return { lat: null, lng: null };

  // An explicitly saved point always wins - the farmer may have dropped it at the
  // gate or the shed, which is a better destination than the geometric centre.
  if (f.latitude !== null && f.longitude !== null) {
    return { lat: Number(f.latitude), lng: Number(f.longitude) };
  }

  // A field mapped only by drawing its outline has no point - use the boundary's
  // centroid so the visit still has a destination (for the admin board, history
  // and reports that read dest_latitude/longitude directly).
  return (
    polygonCentroid(f.boundary as GeoJSONPolygon | null) ?? {
      lat: null,
      lng: null,
    }
  );
}

export interface StartVisitInput {
  fieldId: string;
}

export async function startVisit(
  assessorId: string,
  input: StartVisitInput
): Promise<PublicVisit> {
  const field = await findFieldWithFarmer(input.fieldId);
  if (!field) throw ApiError.notFound("Field not found.");

  // A visit is physical (field-level), so it is tied to the assessor's current
  // live enrollment for this field. Resolve the program the assessor is actually
  // assigned to assess this field under - a field can sit in more than one
  // program, and resolving the program without the assessor could land on one
  // they are not assigned to and reject a visit they are entitled to.
  const programId = await resolveAssessorProgramForField(
    assessorId,
    input.fieldId
  );
  if (!programId) {
    throw ApiError.forbidden(
      "You can't visit this field - it isn't assigned to you for assessment."
    );
  }

  // A closed/ended program, or an inactive farm/field, is not visitable.
  await assertAssessmentWritable(input.fieldId, programId);

  const existing = await findActiveVisitForAssessor(assessorId);
  if (existing) {
    throw ApiError.conflict(
      "You already have an active visit. End it before starting another."
    );
  }

  const dest = await fieldDestination(input.fieldId);

  const visit = await createVisit({
    assessorId,
    farmerId: field.farmer_id,
    programId,
    fieldId: input.fieldId,
    destLatitude: dest.lat,
    destLongitude: dest.lng,
  });

  void notifyUser({
    userId: field.farmer_id,
    type: "assessor_visit_started",
    title: "Your assessor is on the way",
    body: visit.assessor_name
      ? `${visit.assessor_name} has started a visit to "${field.name}".`
      : `An assessor has started a visit to "${field.name}".`,
    data: { visitId: visit.id, fieldId: field.id },
    emailFor: (r) =>
      visitStartedEmail({
        fullName: r.fullName,
        assessorName: visit.assessor_name,
        fieldName: field.name,
      }),
  });

  // Live-update the admin Live Visits screen and the farmer's device.
  broadcastToAdmins("visits", { visitId: visit.id });
  emitSync(field.farmer_id, { resource: "field", action: "updated", fieldId: field.id });

  return visit;
}

async function loadOwnedVisit(
  visitId: string,
  assessorId: string
): Promise<PublicVisit> {
  const visit = await findVisitById(visitId);
  if (!visit) throw ApiError.notFound("Visit not found.");
  if (visit.assessor_id !== assessorId) {
    throw ApiError.forbidden("This visit belongs to another assessor.");
  }
  return visit;
}

// 4.6 rate limit: at most one accepted position per visit every few seconds.
// In-memory is fine - it only guards a buggy client hammering the endpoint.
const MIN_LOCATION_INTERVAL_MS = 3_000;
const lastAcceptedAt = new Map<string, number>();

// 4.2 history throttle: skip storing a point that is neither far nor old enough
// (a stationary assessor would otherwise write thousands of duplicates).
const HISTORY_MIN_METERS = 20;
const HISTORY_MIN_SECONDS = 15;

// 4.4 anti-spoof.
const IMPOSSIBLE_SPEED_KMH = 200;
const TELEPORT_METERS = 50_000;
const TELEPORT_WINDOW_MS = 5 * 60 * 1000;

export interface LocationUpdate {
  lat: number;
  lng: number;
  accuracyM: number | null;
  isMock: boolean;
}

export async function pushLocation(
  visitId: string,
  assessorId: string,
  update: LocationUpdate
): Promise<PublicVisit> {
  await loadOwnedVisit(visitId, assessorId);

  // 4.6 - drop excessively frequent writes, but still return current state.
  const now = Date.now();
  const prev = lastAcceptedAt.get(visitId);
  if (prev && now - prev < MIN_LOCATION_INTERVAL_MS) {
    const current = await findVisitById(visitId);
    if (!current) throw ApiError.badRequest("This visit is no longer active.");
    return current;
  }
  lastAcceptedAt.set(visitId, now);

  const updated = await updateVisitLocation(visitId, update.lat, update.lng);
  if (!updated) {
    throw ApiError.badRequest("This visit is no longer active.");
  }

  // History + anti-spoof are best-effort - never let them break live tracking.
  void recordLocationHistory(visitId, update);
  return updated;
}

async function recordLocationHistory(
  visitId: string,
  update: LocationUpdate
): Promise<void> {
  try {
    if (update.isMock) await flagVisitLocation(visitId, "mock_location");

    const last = await getLastVisitLocationRow(visitId);
    if (last) {
      const meters = haversineMeters(
        { lat: update.lat, lng: update.lng },
        { lat: Number(last.latitude), lng: Number(last.longitude) }
      );
      const seconds = (Date.now() - last.recorded_at.getTime()) / 1000;

      // 4.4 - a jump too fast to be real is a review flag, not a block.
      if (seconds > 0 && (meters / seconds) * 3.6 > IMPOSSIBLE_SPEED_KMH) {
        await flagVisitLocation(visitId, "impossible_speed");
      }

      // 4.2 - throttle out near-duplicate stationary points.
      if (meters < HISTORY_MIN_METERS && seconds < HISTORY_MIN_SECONDS) return;
    }

    await insertVisitLocation(
      visitId,
      update.lat,
      update.lng,
      update.accuracyM,
      update.isMock
    );
  } catch {
    // Swallow - a history write must never fail the live update.
  }
}

export async function getVisitTrack(
  visitId: string,
  viewerId: string
): Promise<TrackPoint[]> {
  const visit = await findVisitById(visitId);
  if (!visit) throw ApiError.notFound("Visit not found.");
  // Only the two people on the visit (or an admin, handled by the route) see it.
  if (visit.assessor_id !== viewerId && visit.farmer_id !== viewerId) {
    throw ApiError.forbidden("This visit belongs to someone else.");
  }
  return getVisitTrackRows(visitId);
}

export interface ArrivalPosition {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  isMock: boolean;
}

export async function arriveVisit(
  visitId: string,
  assessorId: string,
  position: ArrivalPosition | null
): Promise<PublicVisit> {
  const visit = await loadOwnedVisit(visitId, assessorId);

  // 4.4 anti-spoof: a mock fix, or an arrival that teleported here from far away
  // moments ago, is a review flag.
  if (position?.isMock) await flagVisitLocation(visitId, "mock_location");
  if (position) {
    const last = await getLastVisitLocationRow(visitId);
    if (last) {
      const jump = haversineMeters(
        { lat: position.latitude, lng: position.longitude },
        { lat: Number(last.latitude), lng: Number(last.longitude) }
      );
      const ago = Date.now() - last.recorded_at.getTime();
      if (jump > TELEPORT_METERS && ago < TELEPORT_WINDOW_MS) {
        await flagVisitLocation(visitId, "teleport");
      }
    }
  }

  // Geofence the arrival against the field. The visit already carries the
  // field's boundary and destination point, so no extra query is needed.
  //  - boundary present: metres to the polygon (0 inside), tolerance 150 m
  //  - point only:       metres to the point, tolerance 300 m
  //  - neither:          nothing to check -> distance/verified stay null
  let distanceM: number | null = null;
  let verified: boolean | null = null;
  if (position) {
    const here = { lat: position.latitude, lng: position.longitude };
    if (visit.field_boundary) {
      distanceM = distanceToPolygonMeters(here, visit.field_boundary);
      verified =
        distanceM === null
          ? null
          : distanceM <= env.visitArrival.boundaryToleranceM;
    } else if (visit.dest_latitude !== null && visit.dest_longitude !== null) {
      distanceM = haversineMeters(here, {
        lat: visit.dest_latitude,
        lng: visit.dest_longitude,
      });
      verified = distanceM <= env.visitArrival.pointToleranceM;
    }
  }

  // Enforcement is opt-in. The default records the verdict and lets the admin
  // panel show it - blocking a weak-GPS assessor from closing a real visit is a
  // worse failure than a soft warning.
  if (env.visitArrival.enforce && verified === false) {
    throw ApiError.unprocessable(
      `You look about ${Math.round(
        distanceM ?? 0
      )} m from the field. Move closer and try again.`
    );
  }

  const updated = await markVisitArrived(visitId, {
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    accuracyM: position?.accuracyM ?? null,
    distanceM,
    verified,
  });
  if (!updated) {
    throw ApiError.badRequest("Visit can't be marked arrived (not en route).");
  }

  // 4.5 - the farmer is told when the assessor STARTS; tell them on arrival too,
  // which is the moment they need to walk out to the field.
  void notifyUser({
    userId: updated.farmer_id,
    type: "assessor_visit_arrived",
    title: "Your assessor has arrived",
    body: updated.assessor_name
      ? `${updated.assessor_name} has arrived at "${updated.field_name ?? "your field"}".`
      : `An assessor has arrived at "${updated.field_name ?? "your field"}".`,
    data: { visitId: updated.id, fieldId: updated.field_id },
  });

  return updated;
}

export async function finishVisit(
  visitId: string,
  assessorId: string,
  outcome: "completed" | "cancelled"
): Promise<PublicVisit> {
  await loadOwnedVisit(visitId, assessorId);
  lastAcceptedAt.delete(visitId);
  const updated = await endVisit(visitId, outcome);
  if (!updated) {
    throw ApiError.badRequest("This visit is no longer active.");
  }
  // Live-update the admin Live Visits screen (the visit left the active list).
  broadcastToAdmins("visits", { visitId });
  return updated;
}

export async function getMyAssessorVisit(
  assessorId: string
): Promise<PublicVisit | null> {
  return findActiveVisitForAssessor(assessorId);
}

export async function getMyFarmerVisit(
  farmerId: string
): Promise<PublicVisit | null> {
  return findActiveVisitForFarmer(farmerId);
}

export async function getVisitForViewer(
  visitId: string,
  viewer: { id: string; role: string }
): Promise<PublicVisit> {
  const visit = await findVisitById(visitId);
  if (!visit) throw ApiError.notFound("Visit not found.");
  const isAdmin = viewer.role === "super_admin" || viewer.role === "admin";
  if (
    !isAdmin &&
    visit.assessor_id !== viewer.id &&
    visit.farmer_id !== viewer.id
  ) {
    throw ApiError.forbidden("You don't have access to this visit.");
  }
  return visit;
}

export async function getActiveVisits(): Promise<PublicVisit[]> {
  return listBoardVisits();
}

const ABANDON_AFTER_HOURS = 4;
const LOCATION_RETENTION_DAYS = 90;

// Periodic housekeeping, run from the server on an interval: close visits that
// have gone quiet (4.3) and drop location history for long-finished visits (4.2).
export async function runVisitMaintenance(): Promise<void> {
  const closed = await autoCloseAbandonedVisits(ABANDON_AFTER_HOURS);
  if (closed > 0) broadcastToAdmins("visits", { closed });
  await deleteOldVisitLocations(LOCATION_RETENTION_DAYS);
}
