import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";
// Value import (not `import type`) - Prisma.DbNull is a runtime sentinel used to
// clear the JSONB boundary column to SQL NULL.
import { Prisma } from "@prisma/client";

// A field outline: one closed GeoJSON Polygon ring, [lng, lat] positions.
export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface PublicField {
  id: string;
  farm_id: string;
  farm_name: string;
  name: string;
  area_acres: string | null;
  crop: string | null;
  season: string | null;
  irrigation: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  boundary: GeoJSONPolygon | null;
  boundary_updated_at: string | null;
  sowing_date: string | null;
  expected_harvest: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const PUBLIC_FIELD_SELECT = {
  id: true,
  farm_id: true,
  name: true,
  area_acres: true,
  crop: true,
  season: true,
  irrigation: true,
  location: true,
  latitude: true,
  longitude: true,
  boundary: true,
  boundary_updated_at: true,
  sowing_date: true,
  expected_harvest: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  farms: { select: { name: true } },
} satisfies Prisma.fieldsSelect;

type PublicFieldRow = Prisma.fieldsGetPayload<{ select: typeof PUBLIC_FIELD_SELECT }>;

function dateOnly(d: Date | null): string | null {
  if (d === null) return null;
  return d.toISOString().slice(0, 10);
}

function toPublicField(fi: PublicFieldRow): PublicField {
  return {
    id: fi.id,
    farm_id: fi.farm_id,
    farm_name: fi.farms.name,
    name: fi.name,
    area_acres: fi.area_acres === null ? null : fi.area_acres.toString(),
    crop: fi.crop,
    season: fi.season,
    irrigation: fi.irrigation,
    location: fi.location,
    latitude: fi.latitude === null ? null : Number(fi.latitude),
    longitude: fi.longitude === null ? null : Number(fi.longitude),
    boundary: (fi.boundary as GeoJSONPolygon | null) ?? null,
    boundary_updated_at: fi.boundary_updated_at
      ? fi.boundary_updated_at.toISOString()
      : null,
    sowing_date: dateOnly(fi.sowing_date),
    expected_harvest: dateOnly(fi.expected_harvest),
    is_active: fi.is_active,
    created_at: fi.created_at,
    updated_at: fi.updated_at,
  };
}

function toDate(s: string | null): Date | null {
  return s ? new Date(s) : null;
}

export async function findFieldById(id: string): Promise<PublicField | null> {
  const fi = await prisma.fields.findFirst({
    where: { id, deleted_at: null },
    select: PUBLIC_FIELD_SELECT,
  });
  return fi ? toPublicField(fi) : null;
}

interface CreateFieldParams {
  farmId: string;
  name: string;
  areaAcres: number | null;
  crop: string | null;
  season: string | null;
  irrigation: string | null;
  location: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sowingDate: string | null;
  expectedHarvest: string | null;
  isActive: boolean;
}

export async function createField(p: CreateFieldParams): Promise<PublicField> {
  const created = await prisma.fields.create({
    data: {
      farm_id: p.farmId,
      name: p.name,
      area_acres: p.areaAcres,
      crop: p.crop,
      season: p.season,
      irrigation: p.irrigation,
      location: p.location,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      sowing_date: toDate(p.sowingDate),
      expected_harvest: toDate(p.expectedHarvest),
      is_active: p.isActive,
    },
    select: PUBLIC_FIELD_SELECT,
  });
  return toPublicField(created);
}

export interface ListFieldsFilters {
  farmId?: string;
  ownerId?: string;
  isActive?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

export async function listFields(
  filters: ListFieldsFilters
): Promise<{ rows: PublicField[]; total: number }> {
  const where: Prisma.fieldsWhereInput = { deleted_at: null };

  if (filters.farmId) where.farm_id = filters.farmId;
  if (filters.ownerId) {
    where.farms = { deleted_at: null, owner_id: filters.ownerId };
  }
  if (filters.isActive !== undefined) where.is_active = filters.isActive;
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { crop: { contains: s, mode: "insensitive" } },
      { location: { contains: s, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.fields.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: filters.limit,
      skip: filters.offset,
      select: PUBLIC_FIELD_SELECT,
    }),
    prisma.fields.count({ where }),
  ]);

  return { rows: rows.map(toPublicField), total };
}

interface UpdateFieldParams {
  name?: string;
  areaAcres?: number | null;
  crop?: string | null;
  season?: string | null;
  irrigation?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sowingDate?: string | null;
  expectedHarvest?: string | null;
  isActive?: boolean;
}

export async function updateField(
  id: string,
  p: UpdateFieldParams
): Promise<PublicField | null> {
  const data: Prisma.fieldsUncheckedUpdateManyInput = {};
  if (p.name !== undefined) data.name = p.name;
  if (p.areaAcres !== undefined) data.area_acres = p.areaAcres;
  if (p.crop !== undefined) data.crop = p.crop;
  if (p.season !== undefined) data.season = p.season;
  if (p.irrigation !== undefined) data.irrigation = p.irrigation;
  if (p.location !== undefined) data.location = p.location;
  if (p.latitude !== undefined) data.latitude = p.latitude;
  if (p.longitude !== undefined) data.longitude = p.longitude;
  if (p.sowingDate !== undefined) data.sowing_date = toDate(p.sowingDate);
  if (p.expectedHarvest !== undefined) data.expected_harvest = toDate(p.expectedHarvest);
  if (p.isActive !== undefined) data.is_active = p.isActive;

  if (Object.keys(data).length === 0) return findFieldById(id);

  data.updated_at = new Date();

  const { count } = await prisma.fields.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findFieldById(id);
}

// Replace (or clear) a field's boundary. A boundary is written wholesale by the
// editor, never merged. Passing null clears it to SQL NULL via Prisma.DbNull.
export async function updateFieldBoundary(
  id: string,
  boundary: GeoJSONPolygon | null
): Promise<PublicField | null> {
  const { count } = await prisma.fields.updateMany({
    where: { id, deleted_at: null },
    data: {
      boundary:
        boundary === null
          ? Prisma.DbNull
          : (boundary as unknown as Prisma.InputJsonValue),
      boundary_updated_at: boundary === null ? null : new Date(),
      updated_at: new Date(),
    },
  });
  if (!count) return null;
  return findFieldById(id);
}

export async function softDeleteField(id: string): Promise<boolean> {
  const affected = await softDelete("fields", id);
  return affected > 0;
}

// Soft-deletes a field together with the rows that belong only to it - soil,
// documents and any draft answers - so nothing is left pointing at a removed
// field. Callers must first confirm the field has no submitted assessment and
// is not enrolled. Runs in one transaction so a partial delete can't happen.
export async function softDeleteFieldCascade(id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const { count } = await tx.fields.updateMany({
      where: { id, deleted_at: null },
      data: { deleted_at: now },
    });
    if (count === 0) return false;
    await cascadeFieldChildren(tx, [id], now);
    return true;
  });
}

// Soft-deletes the child rows of one or more fields. Shared by field delete and
// farm delete.
async function cascadeFieldChildren(
  tx: Prisma.TransactionClient,
  fieldIds: string[],
  now: Date
): Promise<void> {
  if (fieldIds.length === 0) return;
  await tx.field_soil.updateMany({
    where: { field_id: { in: fieldIds }, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
  await tx.field_documents.updateMany({
    where: { field_id: { in: fieldIds }, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
  await tx.assessment_responses.updateMany({
    where: { field_id: { in: fieldIds }, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
}

export { cascadeFieldChildren };

// Field names must be unique within a farm (case-insensitive), ignoring
// soft-deleted fields.
export async function fieldNameExistsInFarm(
  farmId: string,
  name: string,
  excludeFieldId?: string
): Promise<boolean> {
  const found = await prisma.fields.findFirst({
    where: {
      farm_id: farmId,
      name: { equals: name, mode: "insensitive" },
      deleted_at: null,
      ...(excludeFieldId ? { id: { not: excludeFieldId } } : {}),
    },
    select: { id: true },
  });
  return found !== null;
}

export async function fieldHasSubmittedAssessment(fieldId: string): Promise<boolean> {
  const r = await prisma.field_assessments.findFirst({
    where: { field_id: fieldId, status: "submitted" },
    select: { id: true },
  });
  return r !== null;
}

export async function fieldIsEnrolled(fieldId: string): Promise<boolean> {
  const r = await prisma.program_enrollment_fields.findFirst({
    where: {
      field_id: fieldId,
      deleted_at: null,
      // The enrollment and its program must both be alive - a field attached to
      // a removed program is not really enrolled and must not be left stuck.
      program_enrollments: {
        deleted_at: null,
        programs: { deleted_at: null },
      },
    },
    select: { id: true },
  });
  return r !== null;
}

// Reset clears a field's editable attributes back to empty, keeping its identity
// (name) and its farm. Assessments and soil are not touched.
export async function resetFieldData(fieldId: string): Promise<PublicField | null> {
  const { count } = await prisma.fields.updateMany({
    where: { id: fieldId, deleted_at: null },
    data: {
      area_acres: null,
      crop: null,
      season: null,
      irrigation: null,
      location: null,
      latitude: null,
      longitude: null,
      sowing_date: null,
      expected_harvest: null,
      updated_at: new Date(),
    },
  });
  if (!count) return null;
  return findFieldById(fieldId);
}

export async function listFieldsByFarm(farmId: string): Promise<PublicField[]> {
  const rows = await prisma.fields.findMany({
    where: { farm_id: farmId, deleted_at: null },
    orderBy: { created_at: "desc" },
    select: PUBLIC_FIELD_SELECT,
  });
  return rows.map(toPublicField);
}
