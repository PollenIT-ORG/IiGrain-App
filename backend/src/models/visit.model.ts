import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";

export interface PublicVisit {
  id: string;
  assessor_id: string;
  assessor_name: string | null;
  farmer_id: string;
  farmer_name: string | null;
  program_id: string | null;
  field_id: string | null;
  field_name: string | null;
  status: "en_route" | "arrived" | "completed" | "cancelled";
  dest_latitude: number | null;
  dest_longitude: number | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_at: string | null;
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
  started_at: true,
  arrived_at: true,
  ended_at: true,
  users_field_visits_assessor_idTousers: { select: { full_name: true } },
  users_field_visits_farmer_idTousers: { select: { full_name: true } },
  fields: { select: { name: true } },
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
    status: v.status as PublicVisit["status"],
    dest_latitude: num(v.dest_latitude),
    dest_longitude: num(v.dest_longitude),
    last_latitude: num(v.last_latitude),
    last_longitude: num(v.last_longitude),
    last_location_at: iso(v.last_location_at),
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

export async function markVisitArrived(
  visitId: string
): Promise<PublicVisit | null> {
  const { count } = await prisma.field_visits.updateMany({
    where: { id: visitId, status: "en_route" },
    data: { status: "arrived", arrived_at: new Date(), updated_at: new Date() },
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
