import ApiError from "../utils/ApiError.js";
import {
  summarizeFieldDeletion,
  deleteFieldCascade,
  type DeletionLine,
} from "./cascadeDelete.service.js";
import {
  createField,
  listFields,
  findFieldById,
  updateField,
  listFieldsByFarm,
  fieldNameExistsInFarm,
  resetFieldData,
  updateFieldBoundary,
  type PublicField,
  type GeoJSONPolygon,
  type ListFieldsFilters,
} from "../models/field.model.js";
import { findFarmById } from "../models/farm.model.js";
import { emitSync } from "../socket/liveSync.js";
import { broadcastToAdmins } from "./realtime.service.js";

function nn(v: string | undefined | null): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

async function assertFarmExists(farmId: string): Promise<void> {
  const farm = await findFarmById(farmId);
  if (!farm) throw ApiError.notFound("The selected farm was not found.");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function assertFieldAreaWithinFarm(
  farmId: string,
  newAreaAcres: number | null | undefined,
  excludeFieldId?: string
): Promise<void> {
  const farm = await findFarmById(farmId);
  if (!farm) throw ApiError.notFound("The selected farm was not found.");
  if (farm.area_acres === null) return;

  const farmArea = Number(farm.area_acres);
  if (Number.isNaN(farmArea)) return;

  const fields = await listFieldsByFarm(farmId);
  const othersTotal = fields
    .filter((f) => f.id !== excludeFieldId)
    .reduce((sum, f) => sum + (f.area_acres ? Number(f.area_acres) : 0), 0);

  const thisArea = newAreaAcres ?? 0;
  const total = round2(othersTotal + thisArea);

  if (total > farmArea) {
    const remaining = round2(farmArea - othersTotal);
    throw ApiError.badRequest(
    //   `Total field area (${total} acres) would exceed the farm area ` +
    //     `(${farmArea} acres). Only ${remaining < 0 ? 0 : remaining} acre(s) remain.`
    // );
     `Field area is too large. Only ${remaining < 0 ? 0 : remaining} acre(s) can be added.`
  );
  }
}

async function assertFarmOwner(farmId: string, userId: string): Promise<void> {
  const farm = await findFarmById(farmId);
  if (!farm) throw ApiError.notFound("Farm not found.");
  if (farm.owner_id !== userId) {
    throw ApiError.forbidden("You can only manage fields on your own farms.");
  }
}

interface CreateInput {
  farmId: string;
  name: string;
  areaAcres?: number;
  crop?: string;
  season?: string;
  irrigation?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  sowingDate?: string;
  expectedHarvest?: string;
  isActive?: boolean;
  boundary?: GeoJSONPolygon | null;
}

async function assertFieldNameFree(
  farmId: string,
  name: string,
  excludeFieldId?: string
): Promise<void> {
  if (await fieldNameExistsInFarm(farmId, name, excludeFieldId)) {
    throw ApiError.conflict(
      `This farm already has a field named "${name}". Please use a different name.`
    );
  }
}

// Live sync to the field's owner (the farmer), whether the change came from the
// farmer's own app or from an admin. This is what keeps every device of the
// owner up to date no matter who made the change.
async function syncFieldOwner(
  farmId: string,
  action: "created" | "updated" | "deleted" | "reset",
  fieldId: string
): Promise<void> {
  const farm = await findFarmById(farmId);
  if (farm?.owner_id) {
    emitSync(farm.owner_id, { resource: "field", action, farmId, fieldId });
  }
  // Keep the admin field/dashboard lists live too.
  broadcastToAdmins("fields", { fieldId, farmId });
}

export async function createFieldFor(input: CreateInput): Promise<PublicField> {
  await assertFarmExists(input.farmId);
  const name = input.name.trim();
  await assertFieldNameFree(input.farmId, name);
  await assertFieldAreaWithinFarm(input.farmId, input.areaAcres);
  const field = await createField({
    farmId: input.farmId,
    name,
    areaAcres: input.areaAcres ?? null,
    crop: nn(input.crop),
    season: nn(input.season),
    irrigation: nn(input.irrigation),
    location: nn(input.location),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    sowingDate: nn(input.sowingDate),
    expectedHarvest: nn(input.expectedHarvest),
    isActive: input.isActive ?? true,
    boundary: input.boundary ?? null,
  });
  await syncFieldOwner(input.farmId, "created", field.id);
  return field;
}

interface ListInput {
  page: number;
  limit: number;
  farmId?: string;
  ownerId?: string;
  isActive?: boolean;
  hasBoundary?: boolean;
  search?: string;
}

export async function getFields(input: ListInput): Promise<{
  fields: PublicField[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const filters: ListFieldsFilters = {
    farmId: input.farmId,
    ownerId: input.ownerId,
    isActive: input.isActive,
    hasBoundary: input.hasBoundary,
    search: input.search,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  };
  const { rows, total } = await listFields(filters);
  return {
    fields: rows,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function getFieldById(id: string): Promise<PublicField> {
  const field = await findFieldById(id);
  if (!field) throw ApiError.notFound("Field not found.");
  return field;
}

interface UpdateInput {
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
  /** Left out keeps the stored boundary; null clears it. */
  boundary?: GeoJSONPolygon | null;
}

export async function editField(id: string, input: UpdateInput): Promise<PublicField> {
  const existing = await findFieldById(id);
  if (!existing) throw ApiError.notFound("Field not found.");

  if (input.name !== undefined && input.name.trim()) {
    await assertFieldNameFree(existing.farm_id, input.name.trim(), id);
  }

  if (input.areaAcres !== undefined) {
    await assertFieldAreaWithinFarm(existing.farm_id, input.areaAcres, id);
  }

  const updated = await updateField(id, {
    name: input.name?.trim(),
    areaAcres: input.areaAcres,
    crop: input.crop !== undefined ? nn(input.crop) : undefined,
    season: input.season !== undefined ? nn(input.season) : undefined,
    irrigation: input.irrigation !== undefined ? nn(input.irrigation) : undefined,
    location: input.location !== undefined ? nn(input.location) : undefined,
    latitude: input.latitude !== undefined ? (input.latitude ?? null) : undefined,
    longitude: input.longitude !== undefined ? (input.longitude ?? null) : undefined,
    sowingDate: input.sowingDate !== undefined ? nn(input.sowingDate) : undefined,
    expectedHarvest: input.expectedHarvest !== undefined ? nn(input.expectedHarvest) : undefined,
    isActive: input.isActive,
    boundary: input.boundary,
  });
  if (!updated) throw ApiError.notFound("Field not found.");
  await syncFieldOwner(existing.farm_id, "updated", id);
  return updated;
}

/** What deleting this field takes with it, for the confirmation. */
export async function getFieldDeletionSummary(
  id: string
): Promise<DeletionLine[]> {
  const existing = await findFieldById(id);
  if (!existing) throw ApiError.notFound("Field not found.");
  return summarizeFieldDeletion(id);
}

/**
 * Deletes a field with its soil records, documents, assessments, visits and
 * its place in any program. Being enrolled or assessed used to block this, and
 * that is exactly what left programs counting fields that were not there.
 */
export async function removeField(id: string): Promise<void> {
  const existing = await findFieldById(id);
  if (!existing) throw ApiError.notFound("Field not found.");
  const ok = await deleteFieldCascade(id);
  if (!ok) throw ApiError.notFound("Field not found.");
  await syncFieldOwner(existing.farm_id, "deleted", id);
}

export async function resetFieldById(id: string): Promise<PublicField> {
  const reset = await resetFieldData(id);
  if (!reset) throw ApiError.notFound("Field not found.");
  await syncFieldOwner(reset.farm_id, "reset", id);
  return reset;
}

export async function getMyFarmFields(
  farmId: string,
  userId: string
): Promise<PublicField[]> {
  await assertFarmOwner(farmId, userId);
  return listFieldsByFarm(farmId);
}

export async function getMyFarmFieldById(
  farmId: string,
  fieldId: string,
  userId: string
): Promise<PublicField> {
  await assertFarmOwner(farmId, userId);
  const field = await findFieldById(fieldId);
  if (!field || field.farm_id !== farmId) throw ApiError.notFound("Field not found.");
  return field;
}

export async function createMyFarmField(
  farmId: string,
  userId: string,
  input: Omit<CreateInput, "farmId">
): Promise<PublicField> {
  await assertFarmOwner(farmId, userId);
  // The core createFieldFor emits the sync to the owner.
  return createFieldFor({ ...input, farmId });
}

export async function editMyFarmField(
  farmId: string,
  fieldId: string,
  userId: string,
  input: UpdateInput
): Promise<PublicField> {
  await assertFarmOwner(farmId, userId);
  const field = await findFieldById(fieldId);
  if (!field || field.farm_id !== farmId) throw ApiError.notFound("Field not found.");
  return editField(fieldId, input);
}

export async function removeMyFarmField(
  farmId: string,
  fieldId: string,
  userId: string
): Promise<void> {
  await assertFarmOwner(farmId, userId);
  const field = await findFieldById(fieldId);
  if (!field || field.farm_id !== farmId) throw ApiError.notFound("Field not found.");
  await removeField(fieldId);
}

export async function resetMyFarmField(
  farmId: string,
  fieldId: string,
  userId: string
): Promise<PublicField> {
  await assertFarmOwner(farmId, userId);
  const field = await findFieldById(fieldId);
  if (!field || field.farm_id !== farmId) throw ApiError.notFound("Field not found.");
  return resetFieldById(fieldId);
}

/** Staff save. The role gate is on the route, so only the field is checked. */
export async function saveFieldBoundary(
  fieldId: string,
  boundary: GeoJSONPolygon | null
): Promise<PublicField> {
  const field = await findFieldById(fieldId);
  if (!field) throw ApiError.notFound("Field not found.");
  const updated = await updateFieldBoundary(fieldId, boundary);
  if (!updated) throw ApiError.notFound("Field not found.");
  return updated;
}

export async function saveMyFarmFieldBoundary(
  farmId: string,
  fieldId: string,
  userId: string,
  boundary: GeoJSONPolygon | null
): Promise<PublicField> {
  // Both checks: the farm must belong to the caller, and the field to that farm.
  // Without both, a farmer could overwrite another field's outline by guessing a
  // UUID.
  await assertFarmOwner(farmId, userId);
  const field = await findFieldById(fieldId);
  if (!field || field.farm_id !== farmId) throw ApiError.notFound("Field not found.");

  const updated = await updateFieldBoundary(fieldId, boundary);
  if (!updated) throw ApiError.notFound("Field not found.");
  await syncFieldOwner(farmId, "updated", fieldId);
  return updated;
}
