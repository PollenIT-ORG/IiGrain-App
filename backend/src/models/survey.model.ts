import prisma from "../db/prisma.js";

// The eligibility survey: categories, their 0-3 scale questions, and the score
// bands. All managed from the admin panel so the program team can change them
// without a release.

export type SurveyCategory = "gold" | "silver" | "bronze" | "not_qualified";
// Answers are on a 0-3 scale: Not at all / small / moderate / great extent.
export type ScaleValue = 0 | 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface PublicCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  question_count?: number;
}

const CAT_SELECT = {
  id: true,
  name: true,
  description: true,
  icon: true,
  sort_order: true,
  is_active: true,
};

export async function listCategories(
  activeOnly: boolean
): Promise<PublicCategory[]> {
  const rows = await prisma.survey_categories.findMany({
    where: { deleted_at: null, ...(activeOnly ? { is_active: true } : {}) },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: {
      ...CAT_SELECT,
      _count: {
        select: {
          questions: { where: { deleted_at: null, is_active: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    sort_order: r.sort_order,
    is_active: r.is_active,
    question_count: r._count.questions,
  }));
}

export async function findCategoryById(
  id: string
): Promise<PublicCategory | null> {
  const c = await prisma.survey_categories.findFirst({
    where: { id, deleted_at: null },
    select: CAT_SELECT,
  });
  return c;
}

export interface CategoryParams {
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

export async function createCategory(
  p: CategoryParams
): Promise<PublicCategory> {
  return prisma.survey_categories.create({
    data: {
      name: p.name,
      description: p.description,
      icon: p.icon,
      sort_order: p.sortOrder,
      is_active: p.isActive,
    },
    select: CAT_SELECT,
  });
}

export async function updateCategory(
  id: string,
  p: Partial<CategoryParams>
): Promise<PublicCategory | null> {
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (p.name !== undefined) data.name = p.name;
  if (p.description !== undefined) data.description = p.description;
  if (p.icon !== undefined) data.icon = p.icon;
  if (p.sortOrder !== undefined) data.sort_order = p.sortOrder;
  if (p.isActive !== undefined) data.is_active = p.isActive;
  const { count } = await prisma.survey_categories.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findCategoryById(id);
}

export async function softDeleteCategory(id: string): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.survey_categories.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
  if (count) {
    // Its questions go with it.
    await prisma.survey_questions.updateMany({
      where: { category_id: id, deleted_at: null },
      data: { deleted_at: now, updated_at: now },
    });
  }
  return count > 0;
}

export async function reorderCategories(
  items: Array<{ id: string; sortOrder: number }>
): Promise<number> {
  let n = 0;
  for (const it of items) {
    const { count } = await prisma.survey_categories.updateMany({
      where: { id: it.id, deleted_at: null },
      data: { sort_order: it.sortOrder, updated_at: new Date() },
    });
    n += count;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export interface PublicSurveyQuestion {
  id: string;
  category_id: string | null;
  question_text: string;
  help_text: string | null;
  weight: number;
  sort_order: number;
  is_active: boolean;
}

const Q_SELECT = {
  id: true,
  category_id: true,
  question_text: true,
  help_text: true,
  weight: true,
  sort_order: true,
  is_active: true,
};

/** Active questions in display order. Used by the public survey. */
export async function listActiveQuestions(): Promise<PublicSurveyQuestion[]> {
  return prisma.survey_questions.findMany({
    where: { deleted_at: null, is_active: true, category_id: { not: null } },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: Q_SELECT,
  });
}

/** Every question including inactive ones. Used by the admin panel. */
export async function listAllQuestions(): Promise<PublicSurveyQuestion[]> {
  return prisma.survey_questions.findMany({
    where: { deleted_at: null },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: Q_SELECT,
  });
}

export async function findQuestionById(
  id: string
): Promise<PublicSurveyQuestion | null> {
  return prisma.survey_questions.findFirst({
    where: { id, deleted_at: null },
    select: Q_SELECT,
  });
}

export interface CreateQuestionParams {
  categoryId: string;
  questionText: string;
  helpText: string | null;
  weight: number;
  sortOrder: number;
  isActive: boolean;
}

export async function createQuestion(
  p: CreateQuestionParams
): Promise<PublicSurveyQuestion> {
  return prisma.survey_questions.create({
    data: {
      category_id: p.categoryId,
      question_text: p.questionText,
      help_text: p.helpText,
      weight: p.weight,
      sort_order: p.sortOrder,
      is_active: p.isActive,
    },
    select: Q_SELECT,
  });
}

export type UpdateQuestionParams = Partial<CreateQuestionParams>;

export async function updateQuestion(
  id: string,
  p: UpdateQuestionParams
): Promise<PublicSurveyQuestion | null> {
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (p.categoryId !== undefined) data.category_id = p.categoryId;
  if (p.questionText !== undefined) data.question_text = p.questionText;
  if (p.helpText !== undefined) data.help_text = p.helpText;
  if (p.weight !== undefined) data.weight = p.weight;
  if (p.sortOrder !== undefined) data.sort_order = p.sortOrder;
  if (p.isActive !== undefined) data.is_active = p.isActive;

  const { count } = await prisma.survey_questions.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findQuestionById(id);
}

export async function softDeleteQuestion(id: string): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.survey_questions.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
  return count > 0;
}

export async function reorderQuestions(
  items: Array<{ id: string; sortOrder: number }>
): Promise<number> {
  let n = 0;
  for (const it of items) {
    const { count } = await prisma.survey_questions.updateMany({
      where: { id: it.id, deleted_at: null },
      data: { sort_order: it.sortOrder, updated_at: new Date() },
    });
    n += count;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Scoring rules
// ---------------------------------------------------------------------------

export interface ScoringRule {
  id: string;
  category: string;
  min_score: number;
  max_score: number;
  is_active: boolean;
}

const RULE_SELECT = {
  id: true,
  category: true,
  min_score: true,
  max_score: true,
  is_active: true,
};

export async function listScoringRules(): Promise<ScoringRule[]> {
  return prisma.survey_scoring_rules.findMany({
    orderBy: { min_score: "desc" },
    select: RULE_SELECT,
  });
}

export async function updateScoringRule(
  id: string,
  p: { minScore?: number; maxScore?: number; isActive?: boolean }
): Promise<ScoringRule | null> {
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (p.minScore !== undefined) data.min_score = p.minScore;
  if (p.maxScore !== undefined) data.max_score = p.maxScore;
  if (p.isActive !== undefined) data.is_active = p.isActive;
  return prisma.survey_scoring_rules.update({
    where: { id },
    data,
    select: RULE_SELECT,
  });
}
