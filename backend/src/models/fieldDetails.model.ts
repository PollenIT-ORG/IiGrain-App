import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";

export interface PublicSoil {
  id: string;
  field_id: string;
  ph: string | null;
  organic_matter: string | null;
  nitrogen: string | null;
  phosphorus: string | null;
  potassium: string | null;
  moisture: string | null;
  texture: string | null;
  notes: string | null;
  tested_on: string | null;
  created_at: Date;
  updated_at: Date;
}

const SOIL_SELECT = {
  id: true,
  field_id: true,
  ph: true,
  organic_matter: true,
  nitrogen: true,
  phosphorus: true,
  potassium: true,
  moisture: true,
  texture: true,
  notes: true,
  tested_on: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.field_soilSelect;

type SoilRow = Prisma.field_soilGetPayload<{ select: typeof SOIL_SELECT }>;

const dec = (d: Prisma.Decimal | null): string | null =>
  d === null ? null : d.toString();
const dateOnly = (d: Date | null): string | null =>
  d === null ? null : d.toISOString().slice(0, 10);

function toPublicSoil(s: SoilRow): PublicSoil {
  return {
    id: s.id,
    field_id: s.field_id,
    ph: dec(s.ph),
    organic_matter: dec(s.organic_matter),
    nitrogen: dec(s.nitrogen),
    phosphorus: dec(s.phosphorus),
    potassium: dec(s.potassium),
    moisture: dec(s.moisture),
    texture: s.texture,
    notes: s.notes,
    tested_on: dateOnly(s.tested_on),
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}

export async function findSoilByField(
  fieldId: string
): Promise<PublicSoil | null> {
  const s = await prisma.field_soil.findFirst({
    where: { field_id: fieldId, deleted_at: null },
    select: SOIL_SELECT,
  });
  return s ? toPublicSoil(s) : null;
}

// The soil nutrient inputs (pH..moisture) unlock while the field is enrolled in a
// program that is currently usable: live, active, started and not ended. When the
// program closes or ends, the nutrients lock again.
export async function isFieldSoilUnlocked(fieldId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: number }[]>(Prisma.sql`
    SELECT 1 AS ok
      FROM program_enrollment_fields pef
      JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
      JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
     WHERE pef.field_id = ${fieldId}::uuid
       AND pef.deleted_at IS NULL
       AND p.is_active = true
       AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
       AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
     LIMIT 1;`);
  return rows.length > 0;
}

export type SoilLockReason = "unlocked" | "not_enrolled" | "program_closed";

// Tells the caller not just whether soil is locked but WHY, so the message can
// be accurate: a field that was never enrolled needs a different instruction
// from one whose program has since closed or ended.
export async function getSoilLockReason(
  fieldId: string
): Promise<SoilLockReason> {
  const anyEnrollment = await prisma.$queryRaw<{ ok: number }[]>(Prisma.sql`
    SELECT 1 AS ok
      FROM program_enrollment_fields pef
      JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
      JOIN programs p ON p.id = pe.program_id AND p.deleted_at IS NULL
     WHERE pef.field_id = ${fieldId}::uuid
       AND pef.deleted_at IS NULL
     LIMIT 1;`);
  if (anyEnrollment.length === 0) return "not_enrolled";
  const usable = await isFieldSoilUnlocked(fieldId);
  return usable ? "unlocked" : "program_closed";
}

export interface SoilInput {
  ph?: number | null;
  organicMatter?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  moisture?: number | null;
  texture?: string | null;
  notes?: string | null;
  testedOn?: string | null;
}

export async function upsertSoil(
  fieldId: string,
  input: SoilInput
): Promise<PublicSoil> {
  const data: Prisma.field_soilUncheckedUpdateInput = {};
  if ("ph" in input) data.ph = input.ph;
  if ("organicMatter" in input) data.organic_matter = input.organicMatter;
  if ("nitrogen" in input) data.nitrogen = input.nitrogen;
  if ("phosphorus" in input) data.phosphorus = input.phosphorus;
  if ("potassium" in input) data.potassium = input.potassium;
  if ("moisture" in input) data.moisture = input.moisture;
  if ("texture" in input) data.texture = input.texture;
  if ("notes" in input) data.notes = input.notes;
  if ("testedOn" in input) {
    data.tested_on = input.testedOn ? new Date(input.testedOn) : null;
  }

  const existing = await prisma.field_soil.findFirst({
    where: { field_id: fieldId, deleted_at: null },
    select: { id: true },
  });

  const row = existing
    ? await prisma.field_soil.update({
        where: { id: existing.id },
        data: { ...data, updated_at: new Date() },
        select: SOIL_SELECT,
      })
    : await prisma.field_soil.create({
        data: {
          ...(data as Prisma.field_soilUncheckedCreateInput),
          field_id: fieldId,
        },
        select: SOIL_SELECT,
      });

  return toPublicSoil(row);
}

export interface PublicDocument {
  id: string;
  field_id: string;
  name: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const DOC_SELECT = {
  id: true,
  field_id: true,
  name: true,
  url: true,
  mime_type: true,
  size_bytes: true,
  uploaded_by: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.field_documentsSelect;

type DocRow = Prisma.field_documentsGetPayload<{ select: typeof DOC_SELECT }>;

function toPublicDoc(d: DocRow): PublicDocument {
  return {
    id: d.id,
    field_id: d.field_id,
    name: d.name,
    url: d.url,
    mime_type: d.mime_type,
    size_bytes: d.size_bytes === null ? null : Number(d.size_bytes),
    uploaded_by: d.uploaded_by,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
}

export async function listDocumentsByField(
  fieldId: string
): Promise<PublicDocument[]> {
  const rows = await prisma.field_documents.findMany({
    where: { field_id: fieldId, deleted_at: null },
    orderBy: { created_at: "desc" },
    select: DOC_SELECT,
  });
  return rows.map(toPublicDoc);
}

export interface CreateDocInput {
  name: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
}

export async function createDocument(
  fieldId: string,
  input: CreateDocInput
): Promise<PublicDocument> {
  const created = await prisma.field_documents.create({
    data: {
      field_id: fieldId,
      name: input.name,
      url: input.url,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      uploaded_by: input.uploadedBy,
    },
    select: DOC_SELECT,
  });
  return toPublicDoc(created);
}

export async function findDocument(
  fieldId: string,
  docId: string
): Promise<PublicDocument | null> {
  const d = await prisma.field_documents.findFirst({
    where: { id: docId, field_id: fieldId, deleted_at: null },
    select: DOC_SELECT,
  });
  return d ? toPublicDoc(d) : null;
}

export async function softDeleteDocument(docId: string): Promise<boolean> {
  const affected = await softDelete("field_documents", docId);
  return affected > 0;
}

export interface HistoryEvent {
  type: "assessment_submitted" | "field_created" | "field_updated";
  title: string;
  detail: string | null;
  at: Date;
  meta: Record<string, unknown> | null;
}

export async function buildFieldHistory(
  fieldId: string
): Promise<HistoryEvent[]> {
  const events: HistoryEvent[] = [];

  const field = await prisma.fields.findFirst({
    where: { id: fieldId, deleted_at: null },
    select: { name: true, created_at: true, updated_at: true },
  });

  if (field) {
    events.push({
      type: "field_created",
      title: "Field created",
      detail: field.name,
      at: field.created_at,
      meta: null,
    });
    if (field.updated_at.getTime() !== field.created_at.getTime()) {
      events.push({
        type: "field_updated",
        title: "Field updated",
        detail: field.name,
        at: field.updated_at,
        meta: null,
      });
    }
  }

  // Assessments are program-scoped: a field can have several submitted
  // assessments (one per program, per role). Emit one event for each.
  const submissions = await prisma.field_assessments.findMany({
    where: { field_id: fieldId, status: "submitted", submitted_at: { not: null } },
    select: {
      answered: true,
      total_questions: true,
      percentage: true,
      submitted_at: true,
      author_role: true,
      programs: { select: { name: true } },
    },
    orderBy: { submitted_at: "desc" },
  });
  for (const fa of submissions) {
    if (!fa.submitted_at) continue;
    const who = fa.author_role === "assessor" ? "Assessor assessment" : "Self assessment";
    const programName = fa.programs?.name ?? null;
    const programLabel = programName ? ` · ${programName}` : "";
    events.push({
      type: "assessment_submitted",
      title: `${who} submitted`,
      detail: `${fa.answered}/${fa.total_questions} answered · ${fa.percentage.toString()}%${programLabel}`,
      at: fa.submitted_at,
      meta: {
        answered: fa.answered,
        totalQuestions: fa.total_questions,
        percentage: fa.percentage.toString(),
        role: fa.author_role,
        program: programName,
      },
    });
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events;
}
