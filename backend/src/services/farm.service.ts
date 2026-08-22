import ApiError from "../utils/ApiError.js";
import {
  summarizeFarmDeletion,
  deleteFarmCascade,
  type DeletionLine,
} from "./cascadeDelete.service.js";
import { emitSync } from "../socket/liveSync.js";
import { broadcastToAdmins } from "./realtime.service.js";
import {
  createFarm,
  listFarms,
  findFarmById,
  updateFarm,
  listFarmsByOwner,
  resetFarmData,
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

// Syncs a farm change to the owner's devices AND the admin lists in one call.
function syncFarm(
  ownerId: string,
  action: "created" | "updated" | "deleted" | "reset",
  farmId: string
): void {
  emitSync(ownerId, { resource: "farm", action, farmId });
  broadcastToAdmins("farms", { farmId });
}

// A farm cannot be resized smaller than the total area its fields already use.
// `existing` must come from findFarmById (which populates used_area/field_count).
function assertAreaCoversFields(
  existing: PublicFarm,
  newAreaAcres: number | null
): void {
  if (newAreaAcres === null) return; // clearing the size imposes no cap
  const round = (n: number): number => Number(n.toFixed(2));
  const used = round(existing.used_area ? Number(existing.used_area) : 0);
  if (used <= 0) return;
  if (round(newAreaAcres) >= used) return;

  const current = existing.area_acres ? Number(existing.area_acres) : null;
  const reducible = current === null ? null : round(Math.max(0, current - used));
  const count = existing.field_count ?? 0;
  const fieldsLabel = count === 1 ? "field" : "fields";

  const base = `This farm's ${count} ${fieldsLabel} already cover ${used} acres, so the farm size cannot be less than ${used} acres.`;
  const how =
    reducible !== null && reducible > 0
      ? ` You can reduce it by at most ${reducible} acres (down to ${used} acres). To go lower, edit or remove some fields first.`
      : ` Edit or remove some fields first, then reduce the farm.`;
  throw ApiError.badRequest(base + how);
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
  businessEntity?: string;
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

  const farm = await createFarm({
    name: input.name.trim(),
    areaAcres: nnArea(input.areaAcres),
    location: nn(input.location),
    businessEntity: nn(input.businessEntity),
    latitude: nnCoord(input.latitude),
    longitude: nnCoord(input.longitude),
    ownerId: input.ownerId,
    orgId,
    isActive: input.isActive ?? true,
  });
  // Admin created this farm for a farmer - sync the farmer's devices.
  syncFarm(input.ownerId, "created", farm.id);
  return farm;
}

interface ListInput {
  page: number;
  limit: number;
  status?: "active" | "inactive";
  ownerId?: string;
  orgId?: string;
  search?: string;
  sortBy?: "name" | "created_at" | "updated_at" | "area_acres";
  order?: "asc" | "desc";
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
    sortBy: input.sortBy,
    order: input.order,
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
  businessEntity?: string;
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

  if (input.areaAcres !== undefined) {
    assertAreaCoversFields(existing, nnArea(input.areaAcres));
  }

  const updated = await updateFarm(id, {
    name: input.name?.trim(),
    areaAcres: input.areaAcres !== undefined ? nnArea(input.areaAcres) : undefined,
    location: input.location !== undefined ? nn(input.location) : undefined,
    businessEntity: input.businessEntity !== undefined ? nn(input.businessEntity) : undefined,
    latitude: input.latitude !== undefined ? nnCoord(input.latitude) : undefined,
    longitude: input.longitude !== undefined ? nnCoord(input.longitude) : undefined,
    ownerId: input.ownerId,
    orgId,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("Farm not found.");
  // Sync the owner. If the owner was reassigned, sync the previous owner too so
  // the farm disappears from their app.
  syncFarm(updated.owner_id, "updated", id);
  if (existing.owner_id !== updated.owner_id) {
    syncFarm(existing.owner_id, "deleted", id);
  }
  return updated;
}

/** What deleting this farm takes with it, for the confirmation. */
export async function getFarmDeletionSummary(id: string): Promise<DeletionLine[]> {
  const existing = await findFarmById(id);
  if (!existing) throw ApiError.notFound("Farm not found.");
  return summarizeFarmDeletion(id);
}

/**
 * Deletes a farm with its fields and everything recorded on them: soil,
 * documents, assessments, visits and their place in any program. An enrolled
 * field or a submitted assessment used to block this; leaving them behind is
 * what put fields in programs with no farm and assessments in totals with no
 * field, so now they go too. The panel says exactly what before calling this.
 */
export async function removeFarm(id: string): Promise<void> {
  const existing = await findFarmById(id);
  if (!existing) throw ApiError.notFound("Farm not found.");
  const ok = await deleteFarmCascade(id);
  if (!ok) throw ApiError.notFound("Farm not found.");
  syncFarm(existing.owner_id, "deleted", id);
}

export async function resetFarmById(id: string): Promise<PublicFarm> {
  const reset = await resetFarmData(id);
  if (!reset) throw ApiError.notFound("Farm not found.");
  syncFarm(reset.owner_id, "reset", id);
  return reset;
}

export async function removeMyFarm(userId: string, farmId: string): Promise<void> {
  const existing = await findFarmById(farmId);
  if (!existing || existing.owner_id !== userId) {
    throw ApiError.notFound("Farm not found.");
  }
  const ok = await deleteFarmCascade(farmId);
  if (!ok) throw ApiError.notFound("Farm not found.");
  syncFarm(userId, "deleted", farmId);
}

export async function resetMyFarm(
  userId: string,
  farmId: string
): Promise<PublicFarm> {
  const existing = await findFarmById(farmId);
  if (!existing || existing.owner_id !== userId) {
    throw ApiError.notFound("Farm not found.");
  }
  // resetFarmById emits the sync to the owner.
  return resetFarmById(farmId);
}

export interface MyFarmsInput {
  ownerId: string;
  page: number;
  limit: number;
  search?: string;
}

export async function getMyFarms(input: MyFarmsInput): Promise<{
  farms: PublicFarm[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const offset = (input.page - 1) * input.limit;
  const { rows, total } = await listFarmsByOwner({
    ownerId: input.ownerId,
    search: input.search,
    limit: input.limit,
    offset,
  });
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

interface CreateMyFarmInput {
  name: string;
  areaAcres?: number;
  location?: string;
  businessEntity?: string;
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

  const farm = await createFarm({
    name: input.name.trim(),
    areaAcres: nnArea(input.areaAcres),
    location: nn(input.location),
    businessEntity: nn(input.businessEntity),
    latitude: nnCoord(input.latitude),
    longitude: nnCoord(input.longitude),
    ownerId: userId,
    orgId,
    isActive: input.isActive ?? true,
  });
  syncFarm(userId, "created", farm.id);
  return farm;
}

interface UpdateMyFarmInput {
  name?: string;
  areaAcres?: number;
  location?: string;
  businessEntity?: string;
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

  if (input.areaAcres !== undefined) {
    assertAreaCoversFields(existing, nnArea(input.areaAcres));
  }

  const updated = await updateFarm(farmId, {
    name: input.name?.trim(),
    areaAcres: input.areaAcres !== undefined ? nnArea(input.areaAcres) : undefined,
    location: input.location !== undefined ? nn(input.location) : undefined,
    businessEntity: input.businessEntity !== undefined ? nn(input.businessEntity) : undefined,
    latitude: input.latitude !== undefined ? nnCoord(input.latitude) : undefined,
    longitude: input.longitude !== undefined ? nnCoord(input.longitude) : undefined,
  });
  if (!updated) throw ApiError.notFound("Farm not found.");
  syncFarm(userId, "updated", farmId);
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
