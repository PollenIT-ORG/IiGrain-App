import ApiError from "../utils/ApiError.js";
import {
  listActiveQuestions,
  listAllQuestions,
  listScoringRules,
  findQuestionById,
  createQuestion,
  updateQuestion,
  softDeleteQuestion,
  reorderQuestions,
  updateScoringRule,
  listCategories,
  findCategoryById,
  createCategory,
  updateCategory,
  softDeleteCategory,
  reorderCategories,
  type PublicSurveyQuestion,
  type PublicCategory,
  type ScoringRule,
  type SurveyCategory,
  type ScaleValue,
} from "../models/survey.model.js";
import type { StoredAnswer } from "../models/eligibility.model.js";
import { broadcastToAdmins } from "./realtime.service.js";

// The 0-3 answer scale used across the survey.
export const SCALE_LABELS = [
  "Not at all",
  "To a small extent",
  "To a moderate extent",
  "To a great extent",
];
const VALID_SCALE: ScaleValue[] = [0, 1, 2, 3];

// ---------------------------------------------------------------------------
// Public survey: categories, questions, scoring
// ---------------------------------------------------------------------------

export function getActiveCategories(): Promise<PublicCategory[]> {
  return listCategories(true);
}

export function getSurveyQuestions(): Promise<PublicSurveyQuestion[]> {
  return listActiveQuestions();
}

// Resolves a question's answer labels, falling back to the shared defaults for
// any that the admin left blank.
function resolveOptions(q: PublicSurveyQuestion): string[] {
  return SCALE_LABELS.map((def, i) => q.options[i]?.trim() || def);
}

/** Active categories, each with its active questions - what the survey renders. */
export async function getSurveyStructure(): Promise<
  Array<PublicCategory & { questions: PublicSurveyQuestion[] }>
> {
  const [categories, questions] = await Promise.all([
    listCategories(true),
    listActiveQuestions(),
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

/**
 * Scores a set of 0-3 answers against the active questions and bands stored in
 * the database. The score for a question is (answer value) * (weight).
 */
export async function scoreSurvey(
  submitted: Record<string, number>
): Promise<ScoredSurvey> {
  const questions = await listActiveQuestions();

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
  const category = await categoryForScore(score, maxScore);
  return { answers, score, category };
}

// The bands are percentages of the max achievable score, so qualification scales
// with the active question set. Comparing the raw score instead would tie the
// bands to a fixed total, so deactivating categories (which lowers the max) would
// push even a perfect submission below the bands and mark it Not Qualified.
export async function categoryForScore(
  score: number,
  maxScore: number
): Promise<SurveyCategory> {
  // Rounded to a whole percent so a fractional score can never fall in the
  // 1-point gap between adjacent integer bands (e.g. silver 42-62, gold 63-100).
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const rules = await listScoringRules();
  const match = rules.find(
    (r) => r.is_active && pct >= r.min_score && pct <= r.max_score
  );
  return (match?.category as SurveyCategory) ?? "not_qualified";
}

// ---------------------------------------------------------------------------
// Admin: categories
// ---------------------------------------------------------------------------

export function getAllCategories(): Promise<PublicCategory[]> {
  return listCategories(false);
}

export interface CategoryInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function addCategory(
  input: CategoryInput
): Promise<PublicCategory> {
  const all = await listCategories(false);
  const created = await createCategory({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    icon: input.icon?.trim() || null,
    sortOrder:
      input.sortOrder ??
      (all.length ? Math.max(...all.map((c) => c.sort_order)) + 1 : 0),
    isActive: input.isActive ?? true,
  });
  broadcastToAdmins("survey_questions", { categoryId: created.id });
  return created;
}

export async function editCategory(
  id: string,
  input: Partial<CategoryInput>
): Promise<PublicCategory> {
  const existing = await findCategoryById(id);
  if (!existing) throw ApiError.notFound("Category not found.");
  const updated = await updateCategory(id, {
    name: input.name?.trim(),
    description:
      input.description !== undefined ? input.description?.trim() || null : undefined,
    icon: input.icon !== undefined ? input.icon?.trim() || null : undefined,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  });
  if (!updated) throw ApiError.notFound("Category not found.");
  broadcastToAdmins("survey_questions", { categoryId: id });
  return updated;
}

export async function removeCategory(id: string): Promise<void> {
  const ok = await softDeleteCategory(id);
  if (!ok) throw ApiError.notFound("Category not found.");
  broadcastToAdmins("survey_questions", { categoryId: id });
}

export async function reorderCats(
  items: Array<{ id: string; sortOrder: number }>
): Promise<number> {
  const n = await reorderCategories(items);
  broadcastToAdmins("survey_questions");
  return n;
}

// ---------------------------------------------------------------------------
// Admin: questions
// ---------------------------------------------------------------------------

export function getAllQuestions(): Promise<PublicSurveyQuestion[]> {
  return listAllQuestions();
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

// Trims the four answer labels; a blank one becomes null so the survey falls
// back to the shared default.
function normalizeOptions(
  options?: Array<string | null>
): Array<string | null> | undefined {
  if (options === undefined) return undefined;
  return [0, 1, 2, 3].map((i) => options[i]?.trim() || null);
}

export async function addQuestion(
  input: QuestionInput
): Promise<PublicSurveyQuestion> {
  const category = await findCategoryById(input.categoryId);
  if (!category) throw ApiError.badRequest("Choose a valid category.");

  const all = await listAllQuestions();
  const created = await createQuestion({
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
  broadcastToAdmins("survey_questions", { questionId: created.id });
  return created;
}

export async function editQuestion(
  id: string,
  input: Partial<QuestionInput>
): Promise<PublicSurveyQuestion> {
  const existing = await findQuestionById(id);
  if (!existing) throw ApiError.notFound("Question not found.");
  if (input.categoryId) {
    const category = await findCategoryById(input.categoryId);
    if (!category) throw ApiError.badRequest("Choose a valid category.");
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
  broadcastToAdmins("survey_questions", { questionId: id });
  return updated;
}

export async function removeQuestion(id: string): Promise<void> {
  const ok = await softDeleteQuestion(id);
  if (!ok) throw ApiError.notFound("Question not found.");
  broadcastToAdmins("survey_questions", { questionId: id });
}

export async function reorder(
  items: Array<{ id: string; sortOrder: number }>
): Promise<number> {
  const n = await reorderQuestions(items);
  if (n === 0) throw ApiError.notFound("None of those questions were found.");
  broadcastToAdmins("survey_questions");
  return n;
}

// ---------------------------------------------------------------------------
// Admin: scoring rules
// ---------------------------------------------------------------------------

export function getScoringRules(): Promise<ScoringRule[]> {
  return listScoringRules();
}

export async function editScoringRule(
  id: string,
  input: { minScore?: number; maxScore?: number; isActive?: boolean }
): Promise<ScoringRule> {
  if (
    input.minScore !== undefined &&
    input.maxScore !== undefined &&
    input.minScore > input.maxScore
  ) {
    throw ApiError.badRequest(
      "The minimum score cannot be higher than the maximum score."
    );
  }
  const updated = await updateScoringRule(id, input);
  if (!updated) throw ApiError.notFound("Scoring rule not found.");
  broadcastToAdmins("survey_questions", { ruleId: id });
  return updated;
}

/** Highest possible score (every question answered 3), for band sanity checks. */
export async function maxPossibleScore(): Promise<number> {
  const questions = await listActiveQuestions();
  return questions.reduce((sum, q) => sum + 3 * q.weight, 0);
}
