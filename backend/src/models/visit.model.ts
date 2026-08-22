import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import type { GeoJSONPolygon } from "./field.model.js";

export interface PublicVisit {
  id: string;
  assessor_id: string;
  assessor_name: string | null;
  farmer_id: string;
  farmer_name: string | null;
  program_id: string | null;
  field_id: string | null;
  field_name: string | null;
  field_boundary: GeoJSONPolygon | null;
  status: "en_route" | "arrived" | "completed" | "cancelled" | "expired";
  dest_latitude: number | null;
  dest_longitude: number | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_at: string | null;
  arrival_latitude: number | null;
  arrival_longitude: number | null;
  arrival_accuracy_m: number | null;
  arrival_distance_m: number | null;
  arrival_verified: boolean | null;
  location_flag: string | null;
  started_at: string;
  arrived_at: string | null;
  ended_at: string | null;
}

const VISIT_SELECT = {
  id: true,
  assessor_id: true,
  farmer_id: true,
  program_id: true,
  field_id: true,
  status: true,
  dest_latitude: true,
  dest_longitude: true,
  last_latitude: true,
  last_longitude: true,
  last_location_at: true,
  arrival_latitude: true,
  arrival_longitude: true,
  arrival_accuracy_m: true,
  arrival_distance_m: true,
  arrival_verified: true,
  location_flag: true,
  started_at: true,
  arrived_at: true,
  ended_at: true,
  users_field_visits_assessor_idTousers: { select: { full_name: true } },
  users_field_visits_farmer_idTousers: { select: { full_name: true } },
  fields: { select: { name: true, boundary: true } },
} satisfies Prisma.field_visitsSelect;

type VisitRow = Prisma.field_visitsGetPayload<{ select: typeof VISIT_SELECT }>;

function num(d: Prisma.Decimal | null): number | null {
  return d === null ? null : Number(d);
}
function iso(d: Date | null): string | null {
  return d === null ? null : d.toISOString();
}

export function toPublicVisit(v: VisitRow): PublicVisit {
  return {
    id: v.id,
    assessor_id: v.assessor_id,
    assessor_name: v.users_field_visits_assessor_idTousers.full_name,
    farmer_id: v.farmer_id,
    farmer_name: v.users_field_visits_farmer_idTousers.full_name,
    program_id: v.program_id,
    field_id: v.field_id,
    field_name: v.fields?.name ?? null,
    field_boundary: (v.fields?.boundary as GeoJSONPolygon | null) ?? null,
    status: v.status as PublicVisit["status"],
    dest_latitude: num(v.dest_latitude),
    dest_longitude: num(v.dest_longitude),
    last_latitude: num(v.last_latitude),
    last_longitude: num(v.last_longitude),
    last_location_at: iso(v.last_location_at),
    arrival_latitude: num(v.arrival_latitude),
    arrival_longitude: num(v.arrival_longitude),
    arrival_accuracy_m: num(v.arrival_accuracy_m),
    arrival_distance_m: num(v.arrival_distance_m),
    arrival_verified: v.arrival_verified,
    location_flag: v.location_flag,
    started_at: v.started_at.toISOString(),
    arrived_at: iso(v.arrived_at),
    ended_at: iso(v.ended_at),
  };
}

const ACTIVE = ["en_route", "arrived"] as const;

export async function findActiveVisitForAssessor(
  assessorId: string
): Promise<PublicVisit | null> {
  const v = await prisma.field_visits.findFirst({
    where: { assessor_id: assessorId, status: { in: [...ACTIVE] } },
    orderBy: { started_at: "desc" },
    select: VISIT_SELECT,
  });
  return v ? toPublicVisit(v) : null;
}

export async function findActiveVisitForFarmer(
  farmerId: string
): Promise<PublicVisit | null> {
  const v = await prisma.field_visits.findFirst({
    where: { farmer_id: farmerId, status: { in: [...ACTIVE] } },
    orderBy: { started_at: "desc" },
    select: VISIT_SELECT,
  });
  return v ? toPublicVisit(v) : null;
}

export async function findVisitById(id: string): Promise<PublicVisit | null> {
  const v = await prisma.field_visits.findFirst({
    where: { id },
    select: VISIT_SELECT,
  });
  return v ? toPublicVisit(v) : null;
}

export async function listActiveVisits(): Promise<PublicVisit[]> {
  const rows = await prisma.field_visits.findMany({
    where: { status: { in: [...ACTIVE] } },
    orderBy: { started_at: "desc" },
    select: VISIT_SELECT,
  });
  return rows.map(toPublicVisit);
}

// The live-visits board an admin sees: every currently-active visit, plus any
// that finished in the last 12 hours. Keeping recently-ended visits means the
// admin can still see when a visit reached and completed instead of it vanishing
// the instant it ends. Older finished visits drop off on their own.
export async function listBoardVisits(): Promise<PublicVisit[]> {
  const recentCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const rows = await prisma.field_visits.findMany({
    where: {
      OR: [
        { status: { in: [...ACTIVE] } },
        {
          status: { in: ["completed", "cancelled"] },
          ended_at: { gte: recentCutoff },
        },
      ],
    },
    orderBy: { started_at: "desc" },
    select: VISIT_SELECT,
  });
  return rows.map(toPublicVisit);
}

interface CreateVisitParams {
  assessorId: string;
  farmerId: string;
  programId: string | null;
  fieldId: string | null;
  destLatitude: number | null;
  destLongitude: number | null;
}

export async function createVisit(p: CreateVisitParams): Promise<PublicVisit> {
  const created = await prisma.field_visits.create({
    data: {
      assessor_id: p.assessorId,
      farmer_id: p.farmerId,
      program_id: p.programId,
      field_id: p.fieldId,
      dest_latitude: p.destLatitude,
      dest_longitude: p.destLongitude,
      status: "en_route",
    },
    select: VISIT_SELECT,
  });
  return toPublicVisit(created);
}

export async function updateVisitLocation(
  visitId: string,
  lat: number,
  lng: number
): Promise<PublicVisit | null> {
  const { count } = await prisma.field_visits.updateMany({
    where: { id: visitId, status: { in: [...ACTIVE] } },
    data: {
      last_latitude: lat,
      last_longitude: lng,
      last_location_at: new Date(),
      updated_at: new Date(),
    },
  });
  if (!count) return null;
  return findVisitById(visitId);
}

export interface ArrivalRecord {
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  verified: boolean | null;
}

export async function markVisitArrived(
  visitId: string,
  arrival: ArrivalRecord
): Promise<PublicVisit | null> {
  const { count } = await prisma.field_visits.updateMany({
    where: { id: visitId, status: "en_route" },
    data: {
      status: "arrived",
      arrived_at: new Date(),
      arrival_latitude: arrival.latitude,
      arrival_longitude: arrival.longitude,
      arrival_accuracy_m: arrival.accuracyM,
      arrival_distance_m: arrival.distanceM,
      arrival_verified: arrival.verified,
      updated_at: new Date(),
    },
  });
  if (!count) return null;
  return findVisitById(visitId);
}

export async function endVisit(
  visitId: string,
  outcome: "completed" | "cancelled"
): Promise<PublicVisit | null> {
  const { count } = await prisma.field_visits.updateMany({
    where: { id: visitId, status: { in: [...ACTIVE] } },
    data: { status: outcome, ended_at: new Date(), updated_at: new Date() },
  });
  if (!count) return null;
  return findVisitById(visitId);
}

// --- Position history (4.2) + anti-spoof flags (4.4) ----------------------

export interface TrackPoint {
  lat: number;
  lng: number;
  at: string;
}

interface LastLocationRow {
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  recorded_at: Date;
}

export async function getLastVisitLocationRow(
  visitId: string
): Promise<LastLocationRow | null> {
  return prisma.field_visit_locations.findFirst({
    where: { visit_id: visitId },
    orderBy: { recorded_at: "desc" },
    select: { latitude: true, longitude: true, recorded_at: true },
  });
}

export async function insertVisitLocation(
  visitId: string,
  lat: number,
  lng: number,
  accuracyM: number | null,
  isMock: boolean
): Promise<void> {
  await prisma.field_visit_locations.create({
    data: {
      visit_id: visitId,
      latitude: lat,
      longitude: lng,
      accuracy_m: accuracyM,
      is_mock: isMock,
    },
  });
}

// Set the anti-spoof marker once - the first flag on a visit sticks so a later
// clean fix does not clear a genuine concern.
export async function flagVisitLocation(
  visitId: string,
  flag: string
): Promise<void> {
  await prisma.field_visits.updateMany({
    where: { id: visitId, location_flag: null },
    data: { location_flag: flag, updated_at: new Date() },
  });
}

export async function getVisitTrack(
  visitId: string,
  limit = 1000
): Promise<TrackPoint[]> {
  const rows = await prisma.field_visit_locations.findMany({
    where: { visit_id: visitId },
    orderBy: { recorded_at: "asc" },
    select: { latitude: true, longitude: true, recorded_at: true },
    take: limit,
  });
  return rows.map((r) => ({
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    at: r.recorded_at.toISOString(),
  }));
}

// --- Scheduled maintenance (4.3 auto-close, 4.2 retention) ----------------

// Close visits that have gone quiet - no location update (or, if none ever, no
// start) for `hours`. Marks them 'expired' so a forgotten visit does not block
// the next one and the farmer's map stops implying someone is still coming.
export async function autoCloseAbandonedVisits(hours: number): Promise<number> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const { count } = await prisma.field_visits.updateMany({
    where: {
      status: { in: [...ACTIVE] },
      OR: [
        { last_location_at: { lt: cutoff } },
        { last_location_at: null, started_at: { lt: cutoff } },
      ],
    },
    data: { status: "expired", ended_at: new Date(), updated_at: new Date() },
  });
  return count;
}

// Location history is personal data - drop it for visits that ended more than
// `days` ago.
export async function deleteOldVisitLocations(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.field_visit_locations.deleteMany({
    where: { field_visits: { ended_at: { lt: cutoff } } },
  });
  return count;
}
