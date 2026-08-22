import ApiError from "../utils/ApiError.js";
import prisma from "../db/prisma.js";
import {
  listRecords,
  findRecord,
  createRecord,
  updateRecord,
  softDeleteRecord,
  moduleCounts,
  programsForFarm,
  listFarmRecords,
  farmModuleCounts,
  MODULE_KEYS,
  type ModuleKey,
  type ModuleRecord,
  type ModuleCount,
  type FarmProgram,
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
 * field, for this program. That gate runs before every read and every write,
 * because the ids arrive in the URL and a farmer can type whatever he likes.
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
  programId: string;
  programName: string;
}

/**
 * The gate. Confirms the field exists, the program exists, the field is
 * actually enrolled in that program, and that this person may touch it.
 *
 * The enrolment check matters: without it a record could be filed against a
 * program the field never joined, and it would then show up in that program's
 * export as if it belonged there.
 */
export async function assertFieldInProgram(
  fieldId: string,
  programId: string,
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

  if (isFarmer(actor) && field.farms.owner_id !== actor.id) {
    // Deliberately the same message as a missing field, so probing for other
    // people's field ids tells the caller nothing.
    throw ApiError.notFound("Field not found.");
  }

  const program = await prisma.programs.findFirst({
    where: { id: programId, deleted_at: null },
    select: { id: true, name: true },
  });
  if (!program) throw ApiError.notFound("Program not found.");

  const enrolled = await prisma.program_enrollment_fields.findFirst({
    where: {
      field_id: fieldId,
      deleted_at: null,
      program_enrollments: {
        program_id: programId,
        deleted_at: null,
      },
    },
    select: { id: true },
  });
  if (!enrolled) {
    throw ApiError.badRequest(
      "This field is not enrolled in this program, so records cannot be kept against it."
    );
  }

  return {
    fieldId: field.id,
    fieldName: field.name,
    farmName: field.farms.name,
    ownerId: field.farms.owner_id,
    programId: program.id,
    programName: program.name,
  };
}

/**
 * A record must belong to the field and program in the URL. Without this check
 * a valid id from somewhere else would be editable simply by putting it on the
 * end of a URL the caller does have access to.
 */
async function ownedRecord(
  module: ModuleKey,
  id: string,
  ctx: FieldContext
): Promise<ModuleRecord> {
  const record = await findRecord(module, id);
  if (
    !record ||
    record.field_id !== ctx.fieldId ||
    record.program_id !== ctx.programId
  ) {
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
  programId: string;
  actor: Actor;
}): Promise<{ context: FieldContext; records: RecordWithFiles[] }> {
  const context = await assertFieldInProgram(
    input.fieldId,
    input.programId,
    input.actor
  );
  const records = await listRecords(input.module, input.fieldId, input.programId);

  // One grouped query rather than one per row, so a long list stays cheap.
  const counts = await documentCountsByRecord({
    fieldId: input.fieldId,
    programId: input.programId,
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
  programId: string;
  actor: Actor;
}): Promise<ModuleRecord> {
  const ctx = await assertFieldInProgram(
    input.fieldId,
    input.programId,
    input.actor
  );
  return ownedRecord(input.module, input.id, ctx);
}

export async function addRecord(input: {
  module: ModuleKey;
  fieldId: string;
  programId: string;
  data: Record<string, unknown>;
  actor: Actor;
}): Promise<ModuleRecord> {
  await assertFieldInProgram(input.fieldId, input.programId, input.actor);
  return createRecord(input.module, {
    fieldId: input.fieldId,
    programId: input.programId,
    createdBy: input.actor.id,
    data: input.data,
  });
}

export async function editRecord(input: {
  module: ModuleKey;
  id: string;
  fieldId: string;
  programId: string;
  data: Record<string, unknown>;
  actor: Actor;
}): Promise<ModuleRecord> {
  const ctx = await assertFieldInProgram(
    input.fieldId,
    input.programId,
    input.actor
  );
  await ownedRecord(input.module, input.id, ctx);
  return updateRecord(input.module, input.id, input.data);
}

export async function removeRecord(input: {
  module: ModuleKey;
  id: string;
  fieldId: string;
  programId: string;
  actor: Actor;
}): Promise<void> {
  const ctx = await assertFieldInProgram(
    input.fieldId,
    input.programId,
    input.actor
  );
  await ownedRecord(input.module, input.id, ctx);

  // The files attached to it go too, otherwise they are orphaned and would
  // still be counted against the module.
  const files = await listDocuments({
    fieldId: input.fieldId,
    programId: input.programId,
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
};

/**
 * What the app shows when a farmer opens a field: every module with how many
 * records it holds and how many of those are done. Modules with nothing in
 * them are included, so the list is always the full nine.
 */
export async function getModuleSummary(input: {
  fieldId: string;
  programId: string;
  actor: Actor;
}): Promise<{ context: FieldContext; modules: ModuleSummary[] }> {
  const context = await assertFieldInProgram(
    input.fieldId,
    input.programId,
    input.actor
  );

  const counts = await moduleCounts(input.fieldId, input.programId);

  const docRows = await prisma.field_module_documents.groupBy({
    by: ["module"],
    where: {
      field_id: input.fieldId,
      program_id: input.programId,
      deleted_at: null,
    },
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

/**
 * The programs a farm has fields enrolled in, so a workbook can be downloaded
 * straight from the farm rather than hunting through every program first.
 *
 * A farmer only ever sees their own farms; staff see all of them.
 */
export async function getFarmPrograms(
  farmId: string,
  actor: Actor
): Promise<{ farmName: string; programs: FarmProgram[] }> {
  const farm = await prisma.farms.findFirst({
    where: { id: farmId, deleted_at: null },
    select: { id: true, name: true, owner_id: true },
  });
  if (!farm) throw ApiError.notFound("Farm not found.");
  if (isFarmer(actor) && farm.owner_id !== actor.id) {
    throw ApiError.notFound("Farm not found.");
  }

  return { farmName: farm.name, programs: await programsForFarm(farmId) };
}

/**
 * The farm may be looked at as a whole: every field of it, for one program.
 * The gate is the farm rather than a single field, because the caller is
 * asking about the farm.
 */
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
  programId: string;
  actor: Actor;
}): Promise<{ farmName: string; modules: ModuleSummary[] }> {
  const farmName = await assertFarm(input.farmId, input.actor);
  const counts = await farmModuleCounts(input.farmId, input.programId);

  const docRows = await prisma.field_module_documents.groupBy({
    by: ["module"],
    where: {
      program_id: input.programId,
      deleted_at: null,
      fields: { farm_id: input.farmId, deleted_at: null },
    },
    _count: { _all: true },
  });
  const docs = new Map(docRows.map((r) => [r.module, r._count._all]));

  return {
    farmName,
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
  programId: string;
  actor: Actor;
}): Promise<{ farmName: string; records: FarmModuleRecord[] }> {
  const farmName = await assertFarm(input.farmId, input.actor);
  return {
    farmName,
    records: await listFarmRecords(input.module, input.farmId, input.programId),
  };
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function getDocuments(input: {
  fieldId: string;
  programId: string;
  module?: DocumentModule;
  recordId?: string;
  actor: Actor;
}): Promise<PublicModuleDocument[]> {
  await assertFieldInProgram(input.fieldId, input.programId, input.actor);
  return listDocuments({
    fieldId: input.fieldId,
    programId: input.programId,
    module: input.module,
    recordId: input.recordId,
  });
}

export async function addDocument(input: {
  fieldId: string;
  programId: string;
  module: DocumentModule;
  recordId?: string | null;
  kind?: DocumentKind;
  name: string;
  url: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  actor: Actor;
}): Promise<PublicModuleDocument> {
  const ctx = await assertFieldInProgram(
    input.fieldId,
    input.programId,
    input.actor
  );

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
    programId: input.programId,
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
  programId: string;
  actor: Actor;
}): Promise<void> {
  await assertFieldInProgram(input.fieldId, input.programId, input.actor);
  const doc = await findDocument(input.documentId);
  if (
    !doc ||
    doc.field_id !== input.fieldId ||
    doc.program_id !== input.programId
  ) {
    throw ApiError.notFound("Document not found.");
  }
  await softDeleteDocument(input.documentId);
}

export { MODULE_KEYS };
export type { ModuleKey };
