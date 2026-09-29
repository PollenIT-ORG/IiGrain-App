import ApiError from "../utils/ApiError.js";
import { broadcastToAdmins } from "./realtime.service.js";
import { countProgramsCreatedBy } from "../models/program.model.js";
import {
  summarizeSurveyDeletion,
  deleteSurveyCascade,
  type DeletionLine,
} from "./cascadeDelete.service.js";
import {
  listTemplatesForOwner,
  findTemplateById,
  findGlobalTemplate,
  createTemplate,
  updateTemplate,
  setGlobalTemplate,
  listCategories,
  findCategoryById,
  createCategory,
  updateCategory,
  softDeleteCategory,
  listActiveQuestions,
  listAllQuestions,
  findQuestionById,
  createQuestion,
  updateQuestion,
  softDeleteQuestion,
  listScoringRules,
  updateScoringRule,
  type PublicTemplate,
  type PublicCategory,
  type PublicSurveyQuestion,
  type ScoringRule,
  type SurveyCategory,
  type ScaleValue,
} from "../models/programAdminSurveyTemplate.model.js";
import {
  lockedSurveyUsesTemplate,
  type StoredAnswer,
} from "../models/programAdminSurvey.model.js";

export const SCALE_LABELS = [
  "Not at all",
  "To a small extent",
  "To a moderate extent",
  "To a great extent",
];
const VALID_SCALE: ScaleValue[] = [0, 1, 2, 3];

function notify(): void {
  broadcastToAdmins("program_admin_survey");
}

// ---------------------------------------------------------------------------
// Templates - a program admin (ownerId) may see the global one plus their own.
// ---------------------------------------------------------------------------

export function getTemplates(ownerId: string | null): Promise<PublicTemplate[]> {
  return listTemplatesForOwner(ownerId);
}

/** Loads a template and checks the caller may use it (global or their own). */
export async function getTemplateForOwner(
  id: string,
  ownerId: string | null
): Promise<PublicTemplate> {
  const tpl = await findTemplateById(id);
  if (!tpl) throw ApiError.notFound("Template not found.");
  if (ownerId && !tpl.is_global && tpl.owner_id !== ownerId) {
    throw ApiError.forbidden("You do not have access to this template.");
  }
  return tpl;
}

/**
 * A template the caller may edit. The global template is the shared master:
 * only a platform admin (ownerId null) maintains it; a program administrator
 * must copy it to make their own.
 */
async function getEditableTemplate(
  id: string,
  ownerId: string | null
): Promise<PublicTemplate> {
  const tpl = await getTemplateForOwner(id, ownerId);
  if (tpl.is_global && ownerId !== null) {
    throw ApiError.forbidden(
      "The global template cannot be edited. Copy it to make your own."
    );
  }
  // A locked survey is already open to farmers, so its questions stay as they are.
  if (await lockedSurveyUsesTemplate(id)) {
    throw ApiError.conflict(
      "This survey is locked. Unlock it from the program to change or delete it."
    );
  }
  return tpl;
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  // "global" copies the shared global template; a uuid copies that template;
  // "blank" starts fresh.
  basedOn: "global" | "blank" | string;
}

export async function addTemplate(
  ownerId: string | null,
  actorId: string,
  input: CreateTemplateInput
): Promise<PublicTemplate> {
  // A survey exists to be answered for a program, so there has to be one to
  // put it on. Platform admins keep the shared templates and are not bound by
  // this; a program administrator starts by creating their program.
  if (ownerId !== null && (await countProgramsCreatedBy(ownerId)) === 0) {
    throw ApiError.badRequest(
      "Create a program first - a survey belongs to one."
    );
  }

  let copyFromTemplateId: string | null = null;
  if (input.basedOn === "global") {
    const global = await findGlobalTemplate();
    copyFromTemplateId = global?.id ?? null;
  } else if (input.basedOn !== "blank") {
    // Copy another template the caller may access.
    const source = await getTemplateForOwner(input.basedOn, ownerId);
    copyFromTemplateId = source.id;
  }

  const created = await createTemplate({
    ownerId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    createdBy: actorId,
    copyFromTemplateId,
    copyQuestions: true,
  });
  notify();
  return created;
}

export async function editTemplate(
  id: string,
  ownerId: string | null,
  input: { name?: string; description?: string | null; isActive?: boolean }
): Promise<PublicTemplate> {
  const tpl = await getEditableTemplate(id, ownerId);
  const updated = await updateTemplate(id, {
    name: input.name?.trim(),
    description:
      input.description !== undefined ? input.description?.trim() || null : undefined,
    isActive: input.isActive,
    allowGlobal: tpl.is_global,
  });
  if (!updated) throw ApiError.notFound("Template not found.");
  notify();
  return updated;
}

/**
 * Makes a survey the shared global master, replacing whatever held that place.
 * Only the platform team decides this, and only for a survey of their own.
 */
export async function makeGlobal(
  id: string,
  ownerId: string | null
): Promise<PublicTemplate> {
  if (ownerId !== null) {
    throw ApiError.forbidden("Only the platform team sets the global survey.");
  }
  const tpl = await getTemplateForOwner(id, ownerId);
  if (tpl.is_global) return tpl;
  if (tpl.owner_id !== null) {
    throw ApiError.forbidden(
      "Only a survey of your own can be made the global one."
    );
  }
  const updated = await setGlobalTemplate(id);
  if (!updated) throw ApiError.notFound("Template not found.");
  notify();
  return updated;
}

export async function removeTemplate(
  id: string,
  ownerId: string | null
): Promise<void> {
  const tpl = await getEditableTemplate(id, ownerId);
  // The global survey is the shared master every new one is copied from, so
  // only the platform team may retire it - and they are expected to put
  // another one in its place.
  if (tpl.is_global && ownerId !== null) {
    throw ApiError.forbidden("The global survey cannot be deleted.");
  }
  // A survey that a program uses is no longer a reason to refuse: the program
  // loses its survey, and the answers given to questions that no longer exist
  // go with it. The panel says so before this is called.
  const ok = await deleteSurveyCascade(id);
  if (!ok) throw ApiError.notFound("Template not found.");
  notify();
}

/** What deleting this survey takes with it, for the confirmation. */
export async function getSurveyDeletionSummary(
  id: string,
  ownerId: string | null
): Promise<DeletionLine[]> {
  await getEditableTemplate(id, ownerId);
  return summarizeSurveyDeletion(id);
}

// ---------------------------------------------------------------------------
// Public survey structure + scoring (for a template)
// ---------------------------------------------------------------------------

function resolveOptions(q: PublicSurveyQuestion): string[] {
  return SCALE_LABELS.map((def, i) => q.options[i]?.trim() || def);
}

export async function getSurveyStructure(
  templateId: string
): Promise<Array<PublicCategory & { questions: PublicSurveyQuestion[] }>> {
  const [categories, questions] = await Promise.all([
    listCategories(templateId, true),
    listActiveQuestions(templateId),
  ]);
  return categories.map((c) => ({
    ...c,
    questions: questions
      .filter((q) => q.category_id === c.id)
      .map((q) => ({ ...q, options: resolveOptions(q) })),
  }));
}

export interface ScoredSurvey {
  answers: StoredAnswer[];
  score: number;
  category: SurveyCategory;
}

export async function scoreSurvey(
  templateId: string,
  submitted: Record<string, number>
): Promise<ScoredSurvey> {
  const questions = await listActiveQuestions(templateId);
  const missing = questions.filter(
    (q) => !VALID_SCALE.includes(submitted[q.id] as ScaleValue)
  );
  if (missing.length > 0) {
    throw ApiError.validation(
      "Please answer every question before submitting.",
      missing.map((q) => ({ field: q.id, message: "This question is required." }))
    );
  }
  const answers: StoredAnswer[] = questions.map((q) => {
    const value = submitted[q.id] as ScaleValue;
    return { questionId: q.id, answer: value, score: value * q.weight };
  });
  const score = answers.reduce((sum, a) => sum + a.score, 0);
  const maxScore = questions.reduce((sum, q) => sum + 3 * q.weight, 0);
  const category = await categoryForScore(templateId, score, maxScore);
  return { answers, score, category };
}

// Percentage-of-max bands, so qualification scales with the active question set.
export async function categoryForScore(
  templateId: string,
  score: number,
  maxScore: number
): Promise<SurveyCategory> {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const rules = await listScoringRules(templateId);
  const match = rules.find(
    (r) => r.is_active && pct >= r.min_score && pct <= r.max_score
  );
  return (match?.category as SurveyCategory) ?? "not_qualified";
}

export async function maxPossibleScore(templateId: string): Promise<number> {
  const questions = await listActiveQuestions(templateId);
  return questions.reduce((sum, q) => sum + 3 * q.weight, 0);
}

// ---------------------------------------------------------------------------
// Admin: categories / questions / scoring within an editable template
// ---------------------------------------------------------------------------

export function getAllCategories(templateId: string): Promise<PublicCategory[]> {
  return listCategories(templateId, false);
}

export function getAllQuestions(
  templateId: string
): Promise<PublicSurveyQuestion[]> {
  return listAllQuestions(templateId);
}

export function getScoringRules(templateId: string): Promise<ScoringRule[]> {
  return listScoringRules(templateId);
}

export interface CategoryInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function addCategory(
  templateId: string,
  ownerId: string | null,
  input: CategoryInput
): Promise<PublicCategory> {
  await getEditableTemplate(templateId, ownerId);
  const all = await listCategories(templateId, false);
  const created = await createCategory({
    templateId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    icon: input.icon?.trim() || null,
    sortOrder:
      input.sortOrder ??
      (all.length ? Math.max(...all.map((c) => c.sort_order)) + 1 : 0),
    isActive: input.isActive ?? true,
  });
  notify();
  return created;
}

export async function editCategory(
  id: string,
  ownerId: string | null,
  input: Partial<CategoryInput>
): Promise<PublicCategory> {
  const existing = await findCategoryById(id);
  if (!existing) throw ApiError.notFound("Category not found.");
  await getEditableTemplate(existing.template_id, ownerId);
  const updated = await updateCategory(id, {
    name: input.name?.trim(),
    description:
      input.description !== undefined ? input.description?.trim() || null : undefined,
    icon: input.icon !== undefined ? input.icon?.trim() || null : undefined,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("Category not found.");
  notify();
  return updated;
}

export async function removeCategory(
  id: string,
  ownerId: string | null
): Promise<void> {
  const existing = await findCategoryById(id);
  if (!existing) throw ApiError.notFound("Category not found.");
  await getEditableTemplate(existing.template_id, ownerId);
  await softDeleteCategory(id);
  notify();
}

export interface QuestionInput {
  categoryId: string;
  questionText: string;
  helpText?: string | null;
  weight?: number;
  sortOrder?: number;
  isActive?: boolean;
  options?: Array<string | null>;
}

function normalizeOptions(
  options?: Array<string | null>
): Array<string | null> | undefined {
  if (options === undefined) return undefined;
  return [0, 1, 2, 3].map((i) => options[i]?.trim() || null);
}

export async function addQuestion(
  templateId: string,
  ownerId: string | null,
  input: QuestionInput
): Promise<PublicSurveyQuestion> {
  await getEditableTemplate(templateId, ownerId);
  const category = await findCategoryById(input.categoryId);
  if (!category || category.template_id !== templateId) {
    throw ApiError.badRequest("Choose a valid category.");
  }
  const all = await listAllQuestions(templateId);
  const created = await createQuestion({
    templateId,
    categoryId: input.categoryId,
    questionText: input.questionText.trim(),
    helpText: input.helpText?.trim() || null,
    options: normalizeOptions(input.options),
    weight: input.weight ?? 1,
    sortOrder:
      input.sortOrder ??
      (all.length ? Math.max(...all.map((q) => q.sort_order)) + 1 : 0),
    isActive: input.isActive ?? true,
  });
  notify();
  return created;
}

export async function editQuestion(
  id: string,
  ownerId: string | null,
  input: Partial<QuestionInput>
): Promise<PublicSurveyQuestion> {
  const existing = await findQuestionById(id);
  if (!existing) throw ApiError.notFound("Question not found.");
  await getEditableTemplate(existing.template_id, ownerId);
  if (input.categoryId) {
    const category = await findCategoryById(input.categoryId);
    if (!category || category.template_id !== existing.template_id) {
      throw ApiError.badRequest("Choose a valid category.");
    }
  }
  const updated = await updateQuestion(id, {
    categoryId: input.categoryId,
    questionText: input.questionText?.trim(),
    helpText:
      input.helpText !== undefined ? input.helpText?.trim() || null : undefined,
    options: normalizeOptions(input.options),
    weight: input.weight,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("Question not found.");
  notify();
  return updated;
}

export async function removeQuestion(
  id: string,
  ownerId: string | null
): Promise<void> {
  const existing = await findQuestionById(id);
  if (!existing) throw ApiError.notFound("Question not found.");
  await getEditableTemplate(existing.template_id, ownerId);
  await softDeleteQuestion(id);
  notify();
}

export async function editScoringRule(
  id: string,
  templateId: string,
  ownerId: string | null,
  input: { minScore?: number; maxScore?: number; isActive?: boolean }
): Promise<ScoringRule> {
  await getEditableTemplate(templateId, ownerId);
  if (
    input.minScore !== undefined &&
    input.maxScore !== undefined &&
    input.minScore > input.maxScore
  ) {
    throw ApiError.badRequest(
      "The minimum score cannot be higher than the maximum score."
    );
  }
  const rules = await listScoringRules(templateId);
  if (!rules.some((r) => r.id === id)) {
    throw ApiError.notFound("Scoring rule not found.");
  }
  const updated = await updateScoringRule(id, input);
  if (!updated) throw ApiError.notFound("Scoring rule not found.");
  notify();
  return updated;
}
