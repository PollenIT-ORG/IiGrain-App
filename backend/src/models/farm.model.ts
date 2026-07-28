import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";
import { Prisma } from "@prisma/client";
import { cascadeFieldChildren } from "./field.model.js";

export interface PublicFarm {
  id: string;
  name: string;
  area_acres: string | null;
  location: string | null;
  business_entity: string | null;
  latitude: number | null;
  longitude: number | null;
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  org_id: string | null;
  org_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  used_area?: string;
  available_area?: string | null;
  field_count?: number;
}

const PUBLIC_FARM_SELECT = {
  id: true,
  name: true,
  area_acres: true,
  location: true,
  business_entity: true,
  latitude: true,
  longitude: true,
  owner_id: true,
  org_id: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  users: { select: { full_name: true, email: true } },
  organizations: { select: { name: true } },
} satisfies Prisma.farmsSelect;

type PublicFarmRow = Prisma.farmsGetPayload<{ select: typeof PUBLIC_FARM_SELECT }>;

function toPublicFarm(f: PublicFarmRow): PublicFarm {
  return {
    id: f.id,
    name: f.name,
    area_acres: f.area_acres === null ? null : f.area_acres.toString(),
    location: f.location,
    business_entity: f.business_entity,
    latitude: f.latitude === null ? null : Number(f.latitude),
    longitude: f.longitude === null ? null : Number(f.longitude),
    owner_id: f.owner_id,
    owner_name: f.users.full_name,
    owner_email: f.users.email,
    org_id: f.org_id,
    org_name: f.organizations?.name ?? null,
    is_active: f.is_active,
    created_at: f.created_at,
    updated_at: f.updated_at,
  };
}

export async function findFarmById(id: string): Promise<PublicFarm | null> {
  const f = await prisma.farms.findFirst({
    where: { id, deleted_at: null },
    select: PUBLIC_FARM_SELECT,
  });
  if (!f) return null;

  const agg = await prisma.fields.aggregate({
    where: { farm_id: id, deleted_at: null },
    _sum: { area_acres: true },
    _count: { _all: true },
  });
  const usedNum = agg._sum.area_acres ? Number(agg._sum.area_acres) : 0;
  const totalNum = f.area_acres === null ? null : Number(f.area_acres);
  const available =
    totalNum === null ? null : Math.max(0, totalNum - usedNum);

  const farm = toPublicFarm(f);
  farm.used_area = usedNum.toFixed(2);
  farm.available_area = available === null ? null : available.toFixed(2);
  farm.field_count = agg._count._all;
  return farm;
}

interface CreateFarmParams {
  name: string;
  areaAcres: number | null;
  location: string | null;
  businessEntity: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ownerId: string;
  orgId: string | null;
  isActive: boolean;
}

export async function createFarm(p: CreateFarmParams): Promise<PublicFarm> {
  const created = await prisma.farms.create({
    data: {
      name: p.name,
      area_acres: p.areaAcres,
      location: p.location,
      business_entity: p.businessEntity,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      owner_id: p.ownerId,
      org_id: p.orgId,
      is_active: p.isActive,
    },
    select: PUBLIC_FARM_SELECT,
  });
  return toPublicFarm(created);
}

export type FarmSortBy = "name" | "created_at" | "updated_at" | "area_acres";

export interface ListFarmsFilters {
  search?: string;
  status?: "active" | "inactive";
  ownerId?: string;
  orgId?: string;
  sortBy?: FarmSortBy;
  order?: "asc" | "desc";
  limit: number;
  offset: number;
}

export async function listFarms(
  filters: ListFarmsFilters
): Promise<{ rows: PublicFarm[]; total: number }> {
  const where: Prisma.farmsWhereInput = { deleted_at: null };

  if (filters.status) where.is_active = filters.status === "active";
  if (filters.ownerId) where.owner_id = filters.ownerId;
  if (filters.orgId) where.org_id = filters.orgId;
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { location: { contains: s, mode: "insensitive" } },
      { users: { full_name: { contains: s, mode: "insensitive" } } },
    ];
  }

  const sortBy = filters.sortBy ?? "created_at";
  const order = filters.order ?? "desc";
  const orderBy: Prisma.farmsOrderByWithRelationInput = { [sortBy]: order };

  const [rows, total] = await Promise.all([
    prisma.farms.findMany({
      where,
      orderBy,
      take: filters.limit,
      skip: filters.offset,
      select: PUBLIC_FARM_SELECT,
    }),
    prisma.farms.count({ where }),
  ]);

  return { rows: rows.map(toPublicFarm), total };
}

interface UpdateFarmParams {
  name?: string;
  areaAcres?: number | null;
  location?: string | null;
  businessEntity?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ownerId?: string;
  orgId?: string | null;
  isActive?: boolean;
}

export async function updateFarm(
  id: string,
  p: UpdateFarmParams
): Promise<PublicFarm | null> {
  const data: Prisma.farmsUncheckedUpdateManyInput = {};
  if (p.name !== undefined) data.name = p.name;
  if (p.areaAcres !== undefined) data.area_acres = p.areaAcres;
  if (p.location !== undefined) data.location = p.location;
  if (p.businessEntity !== undefined) data.business_entity = p.businessEntity;
  if (p.latitude !== undefined) data.latitude = p.latitude;
  if (p.longitude !== undefined) data.longitude = p.longitude;
  if (p.ownerId !== undefined) data.owner_id = p.ownerId;
  if (p.orgId !== undefined) data.org_id = p.orgId;
  if (p.isActive !== undefined) data.is_active = p.isActive;

  if (Object.keys(data).length === 0) return findFarmById(id);

  data.updated_at = new Date();

  const { count } = await prisma.farms.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findFarmById(id);
}

export async function softDeleteFarm(id: string): Promise<boolean> {
  const affected = await softDelete("farms", id);
  return affected > 0;
}

// Soft-deletes a farm together with its fields and their child rows, so a
// removed farm never leaves active fields behind. Callers must first confirm no
// field has a submitted assessment and none are enrolled. One transaction.
export async function softDeleteFarmCascade(id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const { count } = await tx.farms.updateMany({
      where: { id, deleted_at: null },
      data: { deleted_at: now },
    });
    if (count === 0) return false;
    const fields = await tx.fields.findMany({
      where: { farm_id: id, deleted_at: null },
      select: { id: true },
    });
    const fieldIds = fields.map((f) => f.id);
    if (fieldIds.length > 0) {
      await tx.fields.updateMany({
        where: { id: { in: fieldIds } },
        data: { deleted_at: now, updated_at: now },
      });
      await cascadeFieldChildren(tx, fieldIds, now);
    }
    return true;
  });
}

export async function farmHasSubmittedAssessment(farmId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: number }[]>(Prisma.sql`
    SELECT 1 AS ok
      FROM field_assessments fa
      JOIN fields f ON f.id = fa.field_id
             AND f.deleted_at IS NULL AND f.farm_id = ${farmId}::uuid
     WHERE fa.status = 'submitted'
     LIMIT 1;`);
  return rows.length > 0;
}

export async function farmHasEnrolledField(farmId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: number }[]>(Prisma.sql`
    SELECT 1 AS ok
      FROM program_enrollment_fields pef
      JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
      JOIN fields f ON f.id = pef.field_id
             AND f.deleted_at IS NULL AND f.farm_id = ${farmId}::uuid
     WHERE pef.deleted_at IS NULL
     LIMIT 1;`);
  return rows.length > 0;
}

// Reset clears a farm's editable attributes, keeping its identity (name), owner
// and organization. Its fields and their data are untouched.
export async function resetFarmData(farmId: string): Promise<PublicFarm | null> {
  const { count } = await prisma.farms.updateMany({
    where: { id: farmId, deleted_at: null },
    data: {
      area_acres: null,
      location: null,
      business_entity: null,
      latitude: null,
      longitude: null,
      updated_at: new Date(),
    },
  });
  if (!count) return null;
  return findFarmById(farmId);
}

export interface OwnerFarmsFilters {
  ownerId: string;
  search?: string;
  limit: number;
  offset: number;
}

export async function listFarmsByOwner(
  filters: OwnerFarmsFilters
): Promise<{ rows: PublicFarm[]; total: number }> {
  const where: Prisma.farmsWhereInput = {
    owner_id: filters.ownerId,
    deleted_at: null,
  };
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { location: { contains: s, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.farms.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: filters.limit,
      skip: filters.offset,
      select: PUBLIC_FARM_SELECT,
    }),
    prisma.farms.count({ where }),
  ]);

  return { rows: rows.map(toPublicFarm), total };
}
