import prisma from "../db/prisma.js";

// Program Admin Survey - the survey template config (categories, 0-3 questions,
// and score bands). Mirrors the existing survey.model.ts but everything hangs
// off a template_id, and templates are owned (global vs a program admin's own).

export type SurveyCategory = "gold" | "silver" | "bronze" | "not_qualified";
export type ScaleValue = 0 | 1 | 2 | 3;

// Default percentage bands used when a program admin builds a blank template and
// there is no global template to copy from.
const DEFAULT_RULES: Array<{ category: string; min: number; max: number }> = [
  { category: "not_qualified", min: 0, max: 40 },
  { category: "bronze", min: 41, max: 60 },
  { category: "silver", min: 61, max: 80 },
  { category: "gold", min: 81, max: 100 },
];

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface PublicTemplate {
  id: string;
  owner_id: string | null;
  is_global: boolean;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  category_count?: number;
  question_count?: number;
}

const TPL_SELECT = {
  id: true,
  owner_id: true,
  is_global: true,
  name: true,
  description: true,
  is_active: true,
  created_at: true,
};

/** Templates a program admin may use: the global one plus their own. */
export async function listTemplatesForOwner(
  ownerId: string | null
): Promise<PublicTemplate[]> {
  const rows = await prisma.program_admin_survey_templates.findMany({
    where: {
      deleted_at: null,
      // ownerId null = platform admin, who sees every template.
      ...(ownerId
        ? { OR: [{ is_global: true }, { owner_id: ownerId }] }
        : {}),
    },
    orderBy: [{ is_global: "desc" }, { created_at: "desc" }],
    select: {
      ...TPL_SELECT,
      _count: {
        select: {
          categories: { where: { deleted_at: null } },
          questions: { where: { deleted_at: null } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    owner_id: r.owner_id,
    is_global: r.is_global,
    name: r.name,
    description: r.description,
    is_active: r.is_active,
    created_at: r.created_at,
    category_count: r._count.categories,
    question_count: r._count.questions,
  }));
}

export async function findTemplateById(
  id: string
): Promise<PublicTemplate | null> {
  return prisma.program_admin_survey_templates.findFirst({
    where: { id, deleted_at: null },
    select: TPL_SELECT,
  });
}

export async function findGlobalTemplate(): Promise<PublicTemplate | null> {
  return prisma.program_admin_survey_templates.findFirst({
    where: { is_global: true, deleted_at: null },
    select: TPL_SELECT,
  });
}

/** Creates an owned template, optionally copying another template's content. */
export async function createTemplate(p: {
  ownerId: string | null;
  name: string;
  description: string | null;
  createdBy: string | null;
  copyFromTemplateId?: string | null;
  copyQuestions?: boolean;
}): Promise<PublicTemplate> {
  const created = await prisma.program_admin_survey_templates.create({
    data: {
      owner_id: p.ownerId,
      is_global: false,
      name: p.name,
      description: p.description,
      created_by: p.createdBy,
    },
    select: TPL_SELECT,
  });

  if (p.copyFromTemplateId) {
    await copyTemplateContents(
      p.copyFromTemplateId,
      created.id,
      p.copyQuestions ?? true
    );
  } else {
    // A fresh template still needs score bands to be usable.
    await prisma.program_admin_survey_scoring_rules.createMany({
      data: DEFAULT_RULES.map((r) => ({
        template_id: created.id,
        category: r.category,
        min_score: r.min,
        max_score: r.max,
      })),
    });
  }
  return created;
}

/** Copies categories, questions and score bands from one template to another. */
async function copyTemplateContents(
  sourceId: string,
  targetId: string,
  includeQuestions: boolean
): Promise<void> {
  const [cats, questions, rules] = await Promise.all([
    prisma.program_admin_survey_categories.findMany({
      where: { template_id: sourceId, deleted_at: null },
      orderBy: { sort_order: "asc" },
    }),
    prisma.program_admin_survey_questions.findMany({
      where: { template_id: sourceId, deleted_at: null },
      orderBy: { sort_order: "asc" },
    }),
    prisma.program_admin_survey_scoring_rules.findMany({
      where: { template_id: sourceId },
    }),
  ]);

  const catIdMap = new Map<string, string>();
  for (const c of cats) {
    const nc = await prisma.program_admin_survey_categories.create({
      data: {
        template_id: targetId,
        name: c.name,
        description: c.description,
        icon: c.icon,
        sort_order: c.sort_order,
        is_active: c.is_active,
      },
    });
    catIdMap.set(c.id, nc.id);
  }

  if (includeQuestions) {
    for (const q of questions) {
      await prisma.program_admin_survey_questions.create({
        data: {
          template_id: targetId,
          category_id: q.category_id ? catIdMap.get(q.category_id) ?? null : null,
          question_text: q.question_text,
          help_text: q.help_text,
          option_0: q.option_0,
          option_1: q.option_1,
          option_2: q.option_2,
          option_3: q.option_3,
          weight: q.weight,
          sort_order: q.sort_order,
          is_active: q.is_active,
        },
      });
    }
  }

  const ruleData = (
    rules.length
      ? rules.map((r) => ({
          category: r.category,
          min: r.min_score,
          max: r.max_score,
        }))
      : DEFAULT_RULES
  ).map((r) => ({
    template_id: targetId,
    category: r.category,
    min_score: r.min,
    max_score: r.max,
  }));
  await prisma.program_admin_survey_scoring_rules.createMany({ data: ruleData });
}

export async function updateTemplate(
  id: string,
  p: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    // Only a platform admin may edit the shared global template.
    allowGlobal?: boolean;
  }
): Promise<PublicTemplate | null> {
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (p.name !== undefined) data.name = p.name;
  if (p.description !== undefined) data.description = p.description;
  if (p.isActive !== undefined) data.is_active = p.isActive;
  const { count } = await prisma.program_admin_survey_templates.updateMany({
    where: {
      id,
      deleted_at: null,
      ...(p.allowGlobal ? {} : { is_global: false }),
    },
    data,
  });
  if (!count) return null;
  return findTemplateById(id);
}

export async function softDeleteTemplate(
  id: string,
  allowGlobal = false
): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.program_admin_survey_templates.updateMany({
    where: { id, deleted_at: null, ...(allowGlobal ? {} : { is_global: false }) },
    data: { deleted_at: now, updated_at: now },
  });
  return count > 0;
}

/** Makes one survey the shared global, stepping the previous one down. */
export async function setGlobalTemplate(
  id: string
): Promise<PublicTemplate | null> {
  const now = new Date();
  await prisma.$transaction([
    prisma.program_admin_survey_templates.updateMany({
      where: { is_global: true, id: { not: id } },
      data: { is_global: false, updated_at: now },
    }),
    prisma.program_admin_survey_templates.updateMany({
      where: { id, deleted_at: null },
      data: { is_global: true, updated_at: now },
    }),
  ]);
  return findTemplateById(id);
}

/**
 * True when this survey still powers a real program. Legacy link rows with no
 * program attached must not block a delete.
 */
export async function templateInUse(id: string): Promise<boolean> {
  const found = await prisma.program_admin_surveys.findFirst({
    where: { template_id: id, deleted_at: null, program_id: { not: null } },
    select: { id: true },
  });
  return found !== null;
}

// ---------------------------------------------------------------------------
// Categories (within a template)
// ---------------------------------------------------------------------------

export interface PublicCategory {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  question_count?: number;
}

const CAT_SELECT = {
  id: true,
  template_id: true,
  name: true,
  description: true,
  icon: true,
  sort_order: true,
  is_active: true,
};

export async function listCategories(
  templateId: string,
  activeOnly: boolean
): Promise<PublicCategory[]> {
  const rows = await prisma.program_admin_survey_categories.findMany({
    where: {
      template_id: templateId,
      deleted_at: null,
      ...(activeOnly ? { is_active: true } : {}),
    },
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
    template_id: r.template_id,
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
  return prisma.program_admin_survey_categories.findFirst({
    where: { id, deleted_at: null },
    select: CAT_SELECT,
  });
}

export async function createCategory(p: {
  templateId: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}): Promise<PublicCategory> {
  return prisma.program_admin_survey_categories.create({
    data: {
      template_id: p.templateId,
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
  p: Partial<{
    name: string;
    description: string | null;
    icon: string | null;
    sortOrder: number;
    isActive: boolean;
  }>
): Promise<PublicCategory | null> {
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (p.name !== undefined) data.name = p.name;
  if (p.description !== undefined) data.description = p.description;
  if (p.icon !== undefined) data.icon = p.icon;
  if (p.sortOrder !== undefined) data.sort_order = p.sortOrder;
  if (p.isActive !== undefined) data.is_active = p.isActive;
  const { count } = await prisma.program_admin_survey_categories.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findCategoryById(id);
}

export async function softDeleteCategory(id: string): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.program_admin_survey_categories.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
  if (count) {
    await prisma.program_admin_survey_questions.updateMany({
      where: { category_id: id, deleted_at: null },
      data: { deleted_at: now, updated_at: now },
    });
  }
  return count > 0;
}

// ---------------------------------------------------------------------------
// Questions (within a template)
// ---------------------------------------------------------------------------

export interface PublicSurveyQuestion {
  id: string;
  template_id: string;
  category_id: string | null;
  question_text: string;
  help_text: string | null;
  weight: number;
  sort_order: number;
  is_active: boolean;
  options: Array<string | null>;
}

const Q_SELECT = {
  id: true,
  template_id: true,
  category_id: true,
  question_text: true,
  help_text: true,
  option_0: true,
  option_1: true,
  option_2: true,
  option_3: true,
  weight: true,
  sort_order: true,
  is_active: true,
};

interface QRow {
  id: string;
  template_id: string;
  category_id: string | null;
  question_text: string;
  help_text: string | null;
  option_0: string | null;
  option_1: string | null;
  option_2: string | null;
  option_3: string | null;
  weight: number;
  sort_order: number;
  is_active: boolean;
}

function toPublicQuestion(r: QRow): PublicSurveyQuestion {
  return {
    id: r.id,
    template_id: r.template_id,
    category_id: r.category_id,
    question_text: r.question_text,
    help_text: r.help_text,
    weight: r.weight,
    sort_order: r.sort_order,
    is_active: r.is_active,
    options: [r.option_0, r.option_1, r.option_2, r.option_3],
  };
}

/** Active questions of a template whose category is active too (public survey). */
export async function listActiveQuestions(
  templateId: string
): Promise<PublicSurveyQuestion[]> {
  const rows = await prisma.program_admin_survey_questions.findMany({
    where: {
      template_id: templateId,
      deleted_at: null,
      is_active: true,
      category_id: { not: null },
      category: { is_active: true, deleted_at: null },
    },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: Q_SELECT,
  });
  return rows.map(toPublicQuestion);
}

export async function listAllQuestions(
  templateId: string
): Promise<PublicSurveyQuestion[]> {
  const rows = await prisma.program_admin_survey_questions.findMany({
    where: { template_id: templateId, deleted_at: null },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: Q_SELECT,
  });
  return rows.map(toPublicQuestion);
}

export async function findQuestionById(
  id: string
): Promise<PublicSurveyQuestion | null> {
  const row = await prisma.program_admin_survey_questions.findFirst({
    where: { id, deleted_at: null },
    select: Q_SELECT,
  });
  return row ? toPublicQuestion(row) : null;
}

export async function createQuestion(p: {
  templateId: string;
  categoryId: string;
  questionText: string;
  helpText: string | null;
  weight: number;
  sortOrder: number;
  isActive: boolean;
  options?: Array<string | null>;
}): Promise<PublicSurveyQuestion> {
  const o = p.options ?? [];
  const row = await prisma.program_admin_survey_questions.create({
    data: {
      template_id: p.templateId,
      category_id: p.categoryId,
      question_text: p.questionText,
      help_text: p.helpText,
      option_0: o[0] ?? null,
      option_1: o[1] ?? null,
      option_2: o[2] ?? null,
      option_3: o[3] ?? null,
      weight: p.weight,
      sort_order: p.sortOrder,
      is_active: p.isActive,
    },
    select: Q_SELECT,
  });
  return toPublicQuestion(row);
}

export async function updateQuestion(
  id: string,
  p: Partial<{
    categoryId: string;
    questionText: string;
    helpText: string | null;
    weight: number;
    sortOrder: number;
    isActive: boolean;
    options: Array<string | null>;
  }>
): Promise<PublicSurveyQuestion | null> {
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (p.categoryId !== undefined) data.category_id = p.categoryId;
  if (p.questionText !== undefined) data.question_text = p.questionText;
  if (p.helpText !== undefined) data.help_text = p.helpText;
  if (p.options !== undefined) {
    data.option_0 = p.options[0] ?? null;
    data.option_1 = p.options[1] ?? null;
    data.option_2 = p.options[2] ?? null;
    data.option_3 = p.options[3] ?? null;
  }
  if (p.weight !== undefined) data.weight = p.weight;
  if (p.sortOrder !== undefined) data.sort_order = p.sortOrder;
  if (p.isActive !== undefined) data.is_active = p.isActive;
  const { count } = await prisma.program_admin_survey_questions.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findQuestionById(id);
}

export async function softDeleteQuestion(id: string): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.program_admin_survey_questions.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Scoring rules (within a template)
// ---------------------------------------------------------------------------

export interface ScoringRule {
  id: string;
  template_id: string;
  category: string;
  min_score: number;
  max_score: number;
  is_active: boolean;
}

const RULE_SELECT = {
  id: true,
  template_id: true,
  category: true,
  min_score: true,
  max_score: true,
  is_active: true,
};

export async function listScoringRules(
  templateId: string
): Promise<ScoringRule[]> {
  return prisma.program_admin_survey_scoring_rules.findMany({
    where: { template_id: templateId },
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
  return prisma.program_admin_survey_scoring_rules.update({
    where: { id },
    data,
    select: RULE_SELECT,
  });
}
