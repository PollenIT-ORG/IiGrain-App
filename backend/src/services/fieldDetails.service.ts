import ApiError from "../utils/ApiError.js";
import { findFieldById, type PublicField } from "../models/field.model.js";
import { findFarmById } from "../models/farm.model.js";
import { findFieldWithFarmer } from "../models/assessmentMobile.model.js";
import { emitSync } from "../socket/liveSync.js";
import { isOrgManager } from "../config/rbac.js";
import {
  findSoilByField,
  upsertSoil,
  isFieldSoilUnlocked,
  getSoilLockReason,
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
  resolveProgramForField,
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
  soilLocked?: boolean;
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
    case "soil": {
      const [soil, unlocked] = await Promise.all([
        findSoilByField(fieldId),
        isFieldSoilUnlocked(fieldId),
      ]);
      return { ...base, soil, soilLocked: !unlocked };
    }
    case "docs":
      return { ...base, documents: await listDocumentsByField(fieldId) };
  }
}

// Soil nutrient inputs that only unlock once the field is enrolled in a program.
const SOIL_NUTRIENT_KEYS = [
  "ph",
  "organicMatter",
  "nitrogen",
  "phosphorus",
  "potassium",
  "moisture",
] as const;

export interface SoilResult {
  soil: PublicSoil | null;
  locked: boolean;
}

export async function getSoil(
  fieldId: string,
  actor: Actor
): Promise<SoilResult> {
  await assertFieldAccess(fieldId, actor);
  const [soil, unlocked] = await Promise.all([
    findSoilByField(fieldId),
    isFieldSoilUnlocked(fieldId),
  ]);
  return { soil, locked: !unlocked };
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
): Promise<SoilResult> {
  await assertFieldAccess(fieldId, actor);
  if (!canWriteSoil(actor)) {
    throw ApiError.forbidden("You cannot edit this field's soil record.");
  }

  // Guard on an actual nutrient *value*, not key presence: a client that always
  // sends the full form would otherwise be blocked from saving texture/notes/
  // tested_on on a locked field just because it passed ph: null. Clearing a
  // nutrient (null) writes no nutrient data, so it stays allowed.
  const touchesNutrients = SOIL_NUTRIENT_KEYS.some(
    (k) => input[k] !== undefined && input[k] !== null
  );
  if (touchesNutrients) {
    const reason = await getSoilLockReason(fieldId);
    if (reason === "not_enrolled") {
      throw ApiError.forbidden(
        "Soil nutrient values (pH, organic matter, nitrogen, phosphorus, potassium, moisture) can only be entered once this field is enrolled in an active program."
      );
    }
    if (reason === "program_closed") {
      throw ApiError.forbidden(
        "This field's program is closed or has ended, so its soil nutrient values are locked. They can only be edited while the program is open."
      );
    }
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

  const soil = await upsertSoil(fieldId, payload);
  const unlocked = await isFieldSoilUnlocked(fieldId);

  // Sync the field owner's devices, whether the farmer or an admin made the edit.
  const owner = await findFieldWithFarmer(fieldId);
  if (owner) {
    emitSync(owner.farmer_id, { resource: "soil", action: "updated", fieldId });
  }

  return { soil, locked: !unlocked };
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
      maxScore: number;
      // What each side actually answered, written out for the screen.
      farmerAnswer: string | null;
      assessorAnswer: string | null;
      // How many records each side filled in for this form; 0 for a multiple choice question.
      farmerRecords: number;
      assessorRecords: number;
      farmerAnswered: boolean;
      assessorAnswered: boolean;
      farmerScore: number | null;
      assessorScore: number | null;
      difference: number | null;
    }>;
  }>;
}

export async function getAssessmentComparison(
  fieldId: string,
  actor: Actor,
  programId?: string | null
): Promise<AssessmentComparisonResult> {
  const field = await assertFieldAccess(fieldId, actor);

  const scopedProgramId = programId ?? (await resolveProgramForField(fieldId));
  if (!scopedProgramId) {
    return {
      field: { id: field.id, name: field.name },
      farmer: { submitted: false, submittedAt: null, percentage: null },
      assessor: { submitted: false, submittedAt: null, percentage: null },
      categories: [],
    };
  }

  const rows = await getComparisonRowsForField(fieldId, scopedProgramId);
  const farmerSub = await findFieldAssessment(fieldId, scopedProgramId, "farmer");
  const assessorSub = await findFieldAssessment(fieldId, scopedProgramId, "assessor");

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
      maxScore: r.max_score,
      farmerAnswer: r.farmer_answered ? r.farmer_written ?? "-" : null,
      assessorAnswer: r.assessor_answered ? r.assessor_written ?? "-" : null,
      farmerRecords: r.farmer_records,
      assessorRecords: r.assessor_records,
      farmerAnswered: r.farmer_answered,
      assessorAnswered: r.assessor_answered,
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
