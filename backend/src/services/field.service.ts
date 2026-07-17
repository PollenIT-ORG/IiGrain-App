import ApiError from "../utils/ApiError.js";
import {
  createField,
  listFields,
  findFieldById,
  updateField,
  softDeleteField,
  listFieldsByFarm,
  type PublicField,
  type ListFieldsFilters,
} from "../models/field.model.js";
import { findFarmById } from "../models/farm.model.js";

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
      `Total field area (${total} acres) would exceed the farm area ` +
        `(${farmArea} acres). Only ${remaining < 0 ? 0 : remaining} acre(s) remain.`
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
  status?: "healthy" | "monitor" | "critical";
  isActive?: boolean;
}

export async function createFieldFor(input: CreateInput): Promise<PublicField> {
  await assertFarmExists(input.farmId);
  await assertFieldAreaWithinFarm(input.farmId, input.areaAcres);
  return createField({
    farmId: input.farmId,
    name: input.name.trim(),
    areaAcres: input.areaAcres ?? null,
    crop: nn(input.crop),
    season: nn(input.season),
    irrigation: nn(input.irrigation),
    location: nn(input.location),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    sowingDate: nn(input.sowingDate),
    expectedHarvest: nn(input.expectedHarvest),
    status: input.status ?? "healthy",
    isActive: input.isActive ?? true,
  });
}

interface ListInput {
  page: number;
  limit: number;
  farmId?: string;
  ownerId?: string;
  status?: "healthy" | "monitor" | "critical";
  isActive?: boolean;
  search?: string;
}

export async function getFields(input: ListInput): Promise<{
  fields: PublicField[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const filters: ListFieldsFilters = {
    farmId: input.farmId,
    ownerId: input.ownerId,
    status: input.status,
    isActive: input.isActive,
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
  status?: "healthy" | "monitor" | "critical";
  isActive?: boolean;
}

export async function editField(id: string, input: UpdateInput): Promise<PublicField> {
  const existing = await findFieldById(id);
  if (!existing) throw ApiError.notFound("Field not found.");

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
    status: input.status,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("Field not found.");
  return updated;
}

export async function removeField(id: string): Promise<void> {
  const ok = await softDeleteField(id);
  if (!ok) throw ApiError.notFound("Field not found.");
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
