import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";
import type { Prisma } from "@prisma/client";

export interface PublicFarm {
  id: string;
  name: string;
  area_acres: string | null;
  location: string | null;
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

export interface ListFarmsFilters {
  search?: string;
  status?: "active" | "inactive";
  ownerId?: string;
  orgId?: string;
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

interface UpdateFarmParams {
  name?: string;
  areaAcres?: number | null;
  location?: string | null;
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

export async function listFarmsByOwner(ownerId: string): Promise<PublicFarm[]> {
  const rows = await prisma.farms.findMany({
    where: { owner_id: ownerId, deleted_at: null },
    orderBy: { created_at: "desc" },
    select: PUBLIC_FARM_SELECT,
  });
  return rows.map(toPublicFarm);
}
