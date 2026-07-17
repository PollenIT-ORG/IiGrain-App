import ApiError from "../utils/ApiError.js";
import { findFieldById, type PublicField } from "../models/field.model.js";
import { findFarmById } from "../models/farm.model.js";
import { isOrgManager } from "../config/rbac.js";
import {
  findSoilByField,
  upsertSoil,
  listDocumentsByField,
  createDocument,
  findDocument,
  softDeleteDocument,
  buildFieldHistory,
  type PublicSoil,
  type PublicDocument,
  type HistoryEvent,
  type SoilInput,
} from "../models/fieldDetails.model.js";
import {
  getComparisonRowsForField,
  findFieldAssessment,
} from "../models/assessmentMobile.model.js";

export interface Actor {
  id: string;
  role: string;
}

function nn(v: string | null | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}
function nnNum(v: number | null | undefined): number | null {
  return v === undefined || v === null ? null : v;
}

async function assertFieldAccess(
  fieldId: string,
  actor: Actor
): Promise<PublicField> {
  const field = await findFieldById(fieldId);
  if (!field) throw ApiError.notFound("Field not found.");

  if (isOrgManager(actor.role)) return field;

  const farm = await findFarmById(field.farm_id);
  if (!farm || farm.owner_id !== actor.id) {
    throw ApiError.notFound("Field not found.");
  }
  return field;
}

function canWriteSoil(_actor: Actor): boolean {
  return true;
}

function canWriteDocs(actor: Actor): boolean {
  return !isOrgManager(actor.role);
}

export interface FieldOverview {
  id: string;
  farm_id: string;
  farm_name: string;
  name: string;
  area_acres: string | null;
  crop: string | null;
  season: string | null;
  irrigation: string | null;
  location: string | null;
  sowing_date: string | null;
  expected_harvest: string | null;
  status: PublicField["status"];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FieldDetailsResult {
  tab: "overview" | "history" | "soil" | "docs";
  field: { id: string; name: string };
  overview?: FieldOverview;
  history?: HistoryEvent[];
  soil?: PublicSoil | null;
  documents?: PublicDocument[];
}

export async function getFieldDetails(
  fieldId: string,
  tab: "overview" | "history" | "soil" | "docs",
  actor: Actor
): Promise<FieldDetailsResult> {
  const field = await assertFieldAccess(fieldId, actor);
  const base = { tab, field: { id: field.id, name: field.name } } as const;

  switch (tab) {
    case "overview":
      return { ...base, overview: field as FieldOverview };
    case "history":
      return { ...base, history: await buildFieldHistory(fieldId) };
    case "soil":
      return { ...base, soil: await findSoilByField(fieldId) };
    case "docs":
      return { ...base, documents: await listDocumentsByField(fieldId) };
  }
}

export async function getSoil(
  fieldId: string,
  actor: Actor
): Promise<PublicSoil | null> {
  await assertFieldAccess(fieldId, actor);
  return findSoilByField(fieldId);
}

export async function saveSoil(
  fieldId: string,
  input: {
    ph?: number | null;
    organicMatter?: number | null;
    nitrogen?: number | null;
    phosphorus?: number | null;
    potassium?: number | null;
    moisture?: number | null;
    texture?: string | null;
    notes?: string | null;
    testedOn?: string | null;
  },
  actor: Actor
): Promise<PublicSoil> {
  await assertFieldAccess(fieldId, actor);
  if (!canWriteSoil(actor)) {
    throw ApiError.forbidden("You cannot edit this field's soil record.");
  }

  const payload: SoilInput = {};
  if ("ph" in input) payload.ph = nnNum(input.ph);
  if ("organicMatter" in input) payload.organicMatter = nnNum(input.organicMatter);
  if ("nitrogen" in input) payload.nitrogen = nnNum(input.nitrogen);
  if ("phosphorus" in input) payload.phosphorus = nnNum(input.phosphorus);
  if ("potassium" in input) payload.potassium = nnNum(input.potassium);
  if ("moisture" in input) payload.moisture = nnNum(input.moisture);
  if ("texture" in input) payload.texture = nn(input.texture);
  if ("notes" in input) payload.notes = nn(input.notes);
  if ("testedOn" in input) payload.testedOn = nn(input.testedOn);

  return upsertSoil(fieldId, payload);
}

export async function getDocuments(
  fieldId: string,
  actor: Actor
): Promise<PublicDocument[]> {
  await assertFieldAccess(fieldId, actor);
  return listDocumentsByField(fieldId);
}

export async function addDocument(
  fieldId: string,
  doc: { name: string; url: string; mimeType: string | null; sizeBytes: number | null },
  actor: Actor
): Promise<PublicDocument> {
  await assertFieldAccess(fieldId, actor);
  if (!canWriteDocs(actor)) {
    throw ApiError.forbidden(
      "Only the field's farmer can upload documents."
    );
  }
  return createDocument(fieldId, {
    name: doc.name,
    url: doc.url,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedBy: actor.id,
  });
}

export async function removeDocument(
  fieldId: string,
  docId: string,
  actor: Actor
): Promise<void> {
  await assertFieldAccess(fieldId, actor);
  if (!canWriteDocs(actor)) {
    throw ApiError.forbidden(
      "Only the field's farmer can delete documents."
    );
  }
  const existing = await findDocument(fieldId, docId);
  if (!existing) throw ApiError.notFound("Document not found.");
  await softDeleteDocument(docId);
}

export interface AssessmentComparisonResult {
  field: { id: string; name: string };
  farmer: {
    submitted: boolean;
    submittedAt: string | null;
    percentage: number | null;
  };
  assessor: {
    submitted: boolean;
    submittedAt: string | null;
    percentage: number | null;
  };
  categories: Array<{
    id: string;
    name: string;
    questions: Array<{
      id: string;
      questionCode: string | null;
      questionText: string;
      farmerScore: number | null;
      assessorScore: number | null;
      difference: number | null;
    }>;
  }>;
}

export async function getAssessmentComparison(
  fieldId: string,
  actor: Actor
): Promise<AssessmentComparisonResult> {
  const field = await assertFieldAccess(fieldId, actor);

  const rows = await getComparisonRowsForField(fieldId);
  const farmerSub = await findFieldAssessment(fieldId, "farmer");
  const assessorSub = await findFieldAssessment(fieldId, "assessor");

  const byCat = new Map<string, AssessmentComparisonResult["categories"][number]>();
  for (const r of rows) {
    let cat = byCat.get(r.category_id);
    if (!cat) {
      cat = { id: r.category_id, name: r.category_name, questions: [] };
      byCat.set(r.category_id, cat);
    }
    const diff =
      r.farmer_score !== null && r.assessor_score !== null
        ? r.assessor_score - r.farmer_score
        : null;
    cat.questions.push({
      id: r.question_id,
      questionCode: r.question_code,
      questionText: r.question_text,
      farmerScore: r.farmer_score,
      assessorScore: r.assessor_score,
      difference: diff,
    });
  }

  return {
    field: { id: field.id, name: field.name },
    farmer: {
      submitted: farmerSub?.status === "submitted",
      submittedAt: farmerSub?.submitted_at ? farmerSub.submitted_at.toISOString() : null,
      percentage: farmerSub ? Number(farmerSub.percentage) : null,
    },
    assessor: {
      submitted: assessorSub?.status === "submitted",
      submittedAt: assessorSub?.submitted_at ? assessorSub.submitted_at.toISOString() : null,
      percentage: assessorSub ? Number(assessorSub.percentage) : null,
    },
    categories: [...byCat.values()],
  };
}
