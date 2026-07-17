import ApiError from "../utils/ApiError.js";
import {
  createFarm,
  listFarms,
  findFarmById,
  updateFarm,
  softDeleteFarm,
  listFarmsByOwner,
  type PublicFarm,
  type ListFarmsFilters,
} from "../models/farm.model.js";
import { findById, getUserOrgId } from "../models/user.model.js";
import { findOrgById } from "../models/organization.model.js";
import { getDefaultOrgId } from "./tenancy.service.js";

function nn(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

function nnId(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

function nnArea(v: number | undefined): number | null {
  return v === undefined ? null : v;
}

function nnCoord(v: number | null | undefined): number | null {
  return v === undefined || v === null ? null : v;
}

async function assertOwnerIsFarmer(ownerId: string): Promise<void> {
  const owner = await findById(ownerId);
  if (!owner) throw ApiError.notFound("The selected owner (farmer) was not found.");
  if (owner.role_name !== "farmer") {
    throw ApiError.badRequest("A farm can only be owned by a user with the farmer role.");
  }
}

async function assertOrgExists(orgId: string | null): Promise<void> {
  if (!orgId) return;
  const org = await findOrgById(orgId);
  if (!org) throw ApiError.notFound("The selected organization was not found.");
}

interface CreateInput {
  name: string;
  areaAcres?: number;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  ownerId: string;
  orgId?: string;
  isActive?: boolean;
}

export async function createFarmFor(input: CreateInput): Promise<PublicFarm> {
  await assertOwnerIsFarmer(input.ownerId);

  let orgId = nnId(input.orgId);
  if (!orgId) orgId = await getDefaultOrgId();
  await assertOrgExists(orgId);

  return createFarm({
    name: input.name.trim(),
    areaAcres: nnArea(input.areaAcres),
    location: nn(input.location),
    latitude: nnCoord(input.latitude),
    longitude: nnCoord(input.longitude),
    ownerId: input.ownerId,
    orgId,
    isActive: input.isActive ?? true,
  });
}

interface ListInput {
  page: number;
  limit: number;
  status?: "active" | "inactive";
  ownerId?: string;
  orgId?: string;
  search?: string;
}

export async function getFarms(input: ListInput): Promise<{
  farms: PublicFarm[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const filters: ListFarmsFilters = {
    status: input.status,
    ownerId: input.ownerId,
    orgId: input.orgId,
    search: input.search,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  };
  const { rows, total } = await listFarms(filters);
  return {
    farms: rows,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function getFarmById(id: string): Promise<PublicFarm> {
  const farm = await findFarmById(id);
  if (!farm) throw ApiError.notFound("Farm not found.");
  return farm;
}

interface UpdateInput {
  name?: string;
  areaAcres?: number;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  ownerId?: string;
  orgId?: string;
  isActive?: boolean;
}

export async function editFarm(
  id: string,
  input: UpdateInput
): Promise<PublicFarm> {
  const existing = await findFarmById(id);
  if (!existing) throw ApiError.notFound("Farm not found.");

  if (input.ownerId !== undefined) {
    await assertOwnerIsFarmer(input.ownerId);
  }

  let orgId: string | null | undefined;
  if (input.orgId !== undefined) {
    orgId = nnId(input.orgId);
    await assertOrgExists(orgId);
  }

  const updated = await updateFarm(id, {
    name: input.name?.trim(),
    areaAcres: input.areaAcres !== undefined ? nnArea(input.areaAcres) : undefined,
    location: input.location !== undefined ? nn(input.location) : undefined,
    latitude: input.latitude !== undefined ? nnCoord(input.latitude) : undefined,
    longitude: input.longitude !== undefined ? nnCoord(input.longitude) : undefined,
    ownerId: input.ownerId,
    orgId,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("Farm not found.");
  return updated;
}

export async function removeFarm(id: string): Promise<void> {
  const ok = await softDeleteFarm(id);
  if (!ok) throw ApiError.notFound("Farm not found.");
}

export async function getMyFarms(ownerId: string): Promise<PublicFarm[]> {
  return listFarmsByOwner(ownerId);
}

interface CreateMyFarmInput {
  name: string;
  areaAcres?: number;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  isActive?: boolean;
}

export async function createMyFarm(
  userId: string,
  input: CreateMyFarmInput
): Promise<PublicFarm> {
  await assertOwnerIsFarmer(userId);

  let orgId = await getUserOrgId(userId);
  if (!orgId) orgId = await getDefaultOrgId();
  await assertOrgExists(orgId);

  return createFarm({
    name: input.name.trim(),
    areaAcres: nnArea(input.areaAcres),
    location: nn(input.location),
    latitude: nnCoord(input.latitude),
    longitude: nnCoord(input.longitude),
    ownerId: userId,
    orgId,
    isActive: input.isActive ?? true,
  });
}

interface UpdateMyFarmInput {
  name?: string;
  areaAcres?: number;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export async function editMyFarm(
  userId: string,
  farmId: string,
  input: UpdateMyFarmInput
): Promise<PublicFarm> {
  const existing = await findFarmById(farmId);
  if (!existing || existing.owner_id !== userId) {
    throw ApiError.notFound("Farm not found.");
  }

  const updated = await updateFarm(farmId, {
    name: input.name?.trim(),
    areaAcres: input.areaAcres !== undefined ? nnArea(input.areaAcres) : undefined,
    location: input.location !== undefined ? nn(input.location) : undefined,
    latitude: input.latitude !== undefined ? nnCoord(input.latitude) : undefined,
    longitude: input.longitude !== undefined ? nnCoord(input.longitude) : undefined,
  });
  if (!updated) throw ApiError.notFound("Farm not found.");
  return updated;
}

export async function getMyFarmById(
  ownerId: string,
  farmId: string
): Promise<PublicFarm> {
  const farm = await findFarmById(farmId);
  if (!farm || farm.owner_id !== ownerId) {
    throw ApiError.notFound("Farm not found.");
  }
  return farm;
}
