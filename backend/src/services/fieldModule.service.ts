import ApiError from "../utils/ApiError.js";
import prisma from "../db/prisma.js";
import {
  listRecords,
  findRecord,
  createRecord,
  updateRecord,
  softDeleteRecord,
  moduleCounts,
  fieldsForFarm,
  farmYears,
  listFarmRecords,
  farmModuleCounts,
  MODULE_KEYS,
  MODULE_COLUMNS,
  type ModuleKey,
  type ModuleRecord,
  type ModuleCount,
  type FarmField,
  type FarmModuleRecord,
} from "../models/fieldModule.model.js";
import {
  listDocuments,
  findDocument,
  createDocument,
  softDeleteDocument,
  documentCountsByRecord,
  type PublicModuleDocument,
  type DocumentModule,
  type DocumentKind,
} from "../models/fieldModuleDocument.model.js";

/**
 * Field monitoring modules.
 *
 * Everything here hangs off one gate: is this person allowed to touch this
 * field. It runs before every read and every write, because the ids arrive in
 * the URL and a farmer can send whatever he likes.
 */

export interface Actor {
  id: string;
  role: string;
}

const FARMER = "farmer";

/** Anyone who is not a farmer is staff, and staff see every field. */
function isFarmer(actor: Actor): boolean {
  return actor.role === FARMER;
}

export interface FieldContext {
  fieldId: string;
  fieldName: string;
  farmName: string;
  ownerId: string;
}

/** The gate. Confirms the field exists and that this person may touch it. */
export async function assertField(
  fieldId: string,
  actor: Actor
): Promise<FieldContext> {
  const field = await prisma.fields.findFirst({
    where: { id: fieldId, deleted_at: null },
    select: {
      id: true,
      name: true,
      farms: { select: { name: true, owner_id: true, deleted_at: true } },
    },
  });
  if (!field || field.farms.deleted_at !== null) {
    throw ApiError.notFound("Field not found.");
  }

  // Deliberately the same message as a missing field, so probing for other
  // people's field ids tells the caller nothing.
  if (isFarmer(actor) && field.farms.owner_id !== actor.id) {
    throw ApiError.notFound("Field not found.");
  }

  return {
    fieldId: field.id,
    fieldName: field.name,
    farmName: field.farms.name,
    ownerId: field.farms.owner_id,
  };
}

/** A record must belong to the field in the URL, not just exist somewhere. */
async function ownedRecord(
  module: ModuleKey,
  id: string,
  ctx: FieldContext
): Promise<ModuleRecord> {
  const record = await findRecord(module, id);
  if (!record || record.field_id !== ctx.fieldId) {
    throw ApiError.notFound("Record not found.");
  }
  return record;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface RecordWithFiles extends ModuleRecord {
  document_count: number;
}

export async function getRecords(input: {
  module: ModuleKey;
  fieldId: string;
  actor: Actor;
}): Promise<{ context: FieldContext; records: RecordWithFiles[] }> {
  const context = await assertField(input.fieldId, input.actor);
  const records = await listRecords(input.module, input.fieldId);

  // One grouped query rather than one per row, so a long list stays cheap.
  const counts = await documentCountsByRecord({
    fieldId: input.fieldId,
    module: input.module,
  });

  return {
    context,
    records: records.map((r) => ({
      ...r,
      document_count: counts.get(r.id) ?? 0,
    })),
  };
}

export async function getRecord(input: {
  module: ModuleKey;
  id: string;
  fieldId: string;
  actor: Actor;
}): Promise<ModuleRecord> {
  const ctx = await assertField(input.fieldId, input.actor);
  return ownedRecord(input.module, input.id, ctx);
}

/**
 * A row with nothing in any of its own columns says nothing and clutters the
 * list, so it is refused rather than stored. Status and notes do not count:
 * a status alone is not a record.
 */
function assertNotEmpty(module: ModuleKey, data: Record<string, unknown>): void {
  const filled = MODULE_COLUMNS[module].some((column) => {
    const value = data[column];
    return value !== undefined && value !== null && value !== "";
  });
  if (!filled) {
    throw ApiError.badRequest(
      `Fill in at least one detail before saving this ${LABELS[module].toLowerCase()} record.`
    );
  }
}

export async function addRecord(input: {
  module: ModuleKey;
  fieldId: string;
  data: Record<string, unknown>;
  actor: Actor;
}): Promise<ModuleRecord> {
  await assertField(input.fieldId, input.actor);
  assertNotEmpty(input.module, input.data);
  return createRecord(input.module, {
    fieldId: input.fieldId,
    createdBy: input.actor.id,
    data: input.data,
  });
}

export async function editRecord(input: {
  module: ModuleKey;
  id: string;
  fieldId: string;
  data: Record<string, unknown>;
  actor: Actor;
}): Promise<ModuleRecord> {
  const ctx = await assertField(input.fieldId, input.actor);
  await ownedRecord(input.module, input.id, ctx);
  return updateRecord(input.module, input.id, input.data);
}

export async function removeRecord(input: {
  module: ModuleKey;
  id: string;
  fieldId: string;
  actor: Actor;
}): Promise<void> {
  const ctx = await assertField(input.fieldId, input.actor);
  await ownedRecord(input.module, input.id, ctx);

  // The files attached to it go too, otherwise they are orphaned and would
  // still be counted against the module.
  const files = await listDocuments({
    fieldId: input.fieldId,
    module: input.module,
    recordId: input.id,
  });
  for (const file of files) await softDeleteDocument(file.id);

  await softDeleteRecord(input.module, input.id);
}

// ---------------------------------------------------------------------------
// The module list
// ---------------------------------------------------------------------------

export interface ModuleSummary extends ModuleCount {
  /** How the module is titled on screen. */
  label: string;
  documents: number;
}

const LABELS: Record<ModuleKey, string> = {
  training: "Training",
  soil_samples: "Soil Samples",
  irrigation: "Irrigation",
  pesticide: "Pesticide Use",
  fertilizer: "Synthetic Fertilizer",
  tillage: "Tillage",
  amendment: "Organic Amendments",
  crop: "Crop Diversification",
  nutrient: "Nutrient Management",
  crop_intensification: "Crop Intensification",
  animal_integration: "Animal Integration",
};

/**
 * What the app shows when a farmer opens a field: every module with how many
 * records it holds and how many of those are done. Modules with nothing in
 * them are included, so the list is always the full nine.
 */
export async function getModuleSummary(input: {
  fieldId: string;
  actor: Actor;
}): Promise<{ context: FieldContext; modules: ModuleSummary[] }> {
  const context = await assertField(input.fieldId, input.actor);

  const counts = await moduleCounts(input.fieldId);

  const docRows = await prisma.field_module_documents.groupBy({
    by: ["module"],
    where: { field_id: input.fieldId, deleted_at: null },
    _count: { _all: true },
  });
  const docsByModule = new Map(docRows.map((r) => [r.module, r._count._all]));

  return {
    context,
    modules: counts.map((c) => ({
      ...c,
      label: LABELS[c.module],
      documents: docsByModule.get(c.module) ?? 0,
    })),
  };
}

/** Every field of a farm, so a workbook can be built straight from the farm. */
export async function getFarmFields(
  farmId: string,
  actor: Actor
): Promise<{ farmName: string; fields: FarmField[] }> {
  const farmName = await assertFarm(farmId, actor);
  return { farmName, fields: await fieldsForFarm(farmId) };
}

/** The gate for farm-wide reads, which asks about the farm rather than a field. */
async function assertFarm(farmId: string, actor: Actor): Promise<string> {
  const farm = await prisma.farms.findFirst({
    where: { id: farmId, deleted_at: null },
    select: { name: true, owner_id: true },
  });
  if (!farm) throw ApiError.notFound("Farm not found.");
  if (isFarmer(actor) && farm.owner_id !== actor.id) {
    throw ApiError.notFound("Farm not found.");
  }
  return farm.name;
}

export async function getFarmModuleSummary(input: {
  farmId: string;
  actor: Actor;
}): Promise<{ farmName: string; years: string[]; modules: ModuleSummary[] }> {
  const farmName = await assertFarm(input.farmId, input.actor);
  const counts = await farmModuleCounts(input.farmId);

  const docRows = await prisma.field_module_documents.groupBy({
    by: ["module"],
    where: {
      deleted_at: null,
      fields: { farm_id: input.farmId, deleted_at: null },
    },
    _count: { _all: true },
  });
  const docs = new Map(docRows.map((r) => [r.module, r._count._all]));

  return {
    farmName,
    years: await farmYears(input.farmId),
    modules: counts.map((c) => ({
      ...c,
      label: LABELS[c.module],
      documents: docs.get(c.module) ?? 0,
    })),
  };
}

export async function getFarmRecords(input: {
  module: ModuleKey;
  farmId: string;
  actor: Actor;
}): Promise<{ farmName: string; records: FarmModuleRecord[] }> {
  const farmName = await assertFarm(input.farmId, input.actor);
  return {
    farmName,
    records: await listFarmRecords(input.module, input.farmId),
  };
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function getDocuments(input: {
  fieldId: string;
  module?: DocumentModule;
  recordId?: string;
  actor: Actor;
}): Promise<PublicModuleDocument[]> {
  await assertField(input.fieldId, input.actor);
  return listDocuments({
    fieldId: input.fieldId,
    module: input.module,
    recordId: input.recordId,
  });
}

export async function addDocument(input: {
  fieldId: string;
  module: DocumentModule;
  recordId?: string | null;
  kind?: DocumentKind;
  name: string;
  url: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  actor: Actor;
}): Promise<PublicModuleDocument> {
  const ctx = await assertField(input.fieldId, input.actor);

  // A file that names a record has to name one that exists, in this module,
  // on this field.
  if (input.recordId) {
    if (input.module === "other") {
      throw ApiError.badRequest(
        "A file filed under Other cannot be attached to a record."
      );
    }
    await ownedRecord(input.module as ModuleKey, input.recordId, ctx);
  }

  return createDocument({
    fieldId: input.fieldId,
    module: input.module,
    recordId: input.recordId ?? null,
    kind: input.kind ?? "document",
    name: input.name,
    url: input.url,
    mimeType: input.mimeType ?? null,
    sizeBytes: input.sizeBytes ?? null,
    uploadedBy: input.actor.id,
  });
}

export async function removeDocument(input: {
  documentId: string;
  fieldId: string;
  actor: Actor;
}): Promise<void> {
  await assertField(input.fieldId, input.actor);
  const doc = await findDocument(input.documentId);
  if (!doc || doc.field_id !== input.fieldId) {
    throw ApiError.notFound("Document not found.");
  }
  await softDeleteDocument(input.documentId);
}

export { MODULE_KEYS };
export type { ModuleKey };
