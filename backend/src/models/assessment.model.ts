import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";
import type { AnswerExtra, QuestionType } from "../validators/assessment.schema.js";

export interface PublicCategory {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  question_count: number;
  created_at: Date;
  updated_at: Date;
}

const CATEGORY_SELECT = {
  id: true,
  template_id: true,
  name: true,
  description: true,
  sort_order: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  _count: {
    select: { assessment_questions: { where: { deleted_at: null } } },
  },
} satisfies Prisma.assessment_categoriesSelect;

type CategoryRow = Prisma.assessment_categoriesGetPayload<{
  select: typeof CATEGORY_SELECT;
}>;

function toPublicCategory(c: CategoryRow): PublicCategory {
  return {
    id: c.id,
    template_id: c.template_id,
    name: c.name,
    description: c.description,
    sort_order: c.sort_order,
    is_active: c.is_active,
    question_count: c._count.assessment_questions,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

export async function findCategoryById(
  id: string
): Promise<PublicCategory | null> {
  const c = await prisma.assessment_categories.findFirst({
    where: { id, deleted_at: null },
    select: CATEGORY_SELECT,
  });
  return c ? toPublicCategory(c) : null;
}

export async function listCategories(templateId: string): Promise<PublicCategory[]> {
  const rows = await prisma.assessment_categories.findMany({
    where: { template_id: templateId, deleted_at: null },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: CATEGORY_SELECT,
  });
  return rows.map(toPublicCategory);
}

export async function categoryNameTaken(
  templateId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const found = await prisma.assessment_categories.findFirst({
    where: {
      template_id: templateId,
      deleted_at: null,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return found !== null;
}

interface CreateCategoryParams {
  templateId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export async function createCategory(
  p: CreateCategoryParams
): Promise<PublicCategory> {
  const created = await prisma.assessment_categories.create({
    data: {
      template_id: p.templateId,
      name: p.name,
      description: p.description,
      sort_order: p.sortOrder,
      is_active: p.isActive,
    },
    select: CATEGORY_SELECT,
  });
  return toPublicCategory(created);
}

interface UpdateCategoryParams {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function updateCategory(
  id: string,
  p: UpdateCategoryParams
): Promise<PublicCategory | null> {
  const data: Prisma.assessment_categoriesUncheckedUpdateManyInput = {};
  if (p.name !== undefined) data.name = p.name;
  if (p.description !== undefined) data.description = p.description;
  if (p.sortOrder !== undefined) data.sort_order = p.sortOrder;
  if (p.isActive !== undefined) data.is_active = p.isActive;

  if (Object.keys(data).length === 0) return findCategoryById(id);
  data.updated_at = new Date();

  const { count } = await prisma.assessment_categories.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findCategoryById(id);
}

/**
 * A category and the questions asked under it. A question left behind belongs
 * to a category nothing can show, so it would sit in the bank unusable.
 */
export async function softDeleteCategory(id: string): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.assessment_categories.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
  if (count) {
    await prisma.assessment_questions.updateMany({
      where: { category_id: id, deleted_at: null },
      data: { deleted_at: now, updated_at: now },
    });
  }
  return count > 0;
}

// Returns how many rows matched, so the caller can refuse ids from another template.
export async function reorderCategories(
  templateId: string,
  items: { id: string; sortOrder: number }[]
): Promise<number> {
  if (items.length === 0) return 0;
  const now = new Date();
  const results = await prisma.$transaction(
    items.map((item) =>
      prisma.assessment_categories.updateMany({
        where: { id: item.id, template_id: templateId, deleted_at: null },
        data: { sort_order: item.sortOrder, updated_at: now },
      })
    )
  );
  return results.reduce((sum, r) => sum + r.count, 0);
}

export async function maxCategorySortOrder(templateId: string): Promise<number> {
  const res = await prisma.assessment_categories.aggregate({
    where: { template_id: templateId, deleted_at: null },
    _max: { sort_order: true },
  });
  return res._max.sort_order ?? -1;
}

export interface QuestionOption {
  id: string;
  option_text: string;
  score: number;
  sort_order: number;
}

export interface PublicQuestion {
  id: string;
  template_id: string;
  category_id: string;
  category_name: string;
  question_code: string | null;
  question_text: string;
  question_type: QuestionType;
  max_score: number;
  // Whether a photo and a description come with the answer: off, optional or required.
  evidence_mode: AnswerExtra;
  comment_mode: AnswerExtra;
  guidance_note: string | null;
  score0_description: string | null;
  score1_description: string | null;
  score2_description: string | null;
  score3_description: string | null;
  // The answers to choose from; empty for every type but multiple choice.
  options: QuestionOption[];
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const OPTION_SELECT = {
  id: true,
  option_text: true,
  score: true,
  sort_order: true,
} satisfies Prisma.assessment_question_optionsSelect;

const QUESTION_SELECT = {
  id: true,
  category_id: true,
  question_code: true,
  question_text: true,
  question_type: true,
  max_score: true,
  evidence_mode: true,
  comment_mode: true,
  guidance_note: true,
  score0_description: true,
  score1_description: true,
  score2_description: true,
  score3_description: true,
  sort_order: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  assessment_categories: { select: { name: true, template_id: true } },
  options: {
    where: { deleted_at: null },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: OPTION_SELECT,
  },
} satisfies Prisma.assessment_questionsSelect;

type QuestionRow = Prisma.assessment_questionsGetPayload<{
  select: typeof QUESTION_SELECT;
}>;

function toPublicQuestion(q: QuestionRow): PublicQuestion {
  return {
    id: q.id,
    template_id: q.assessment_categories.template_id,
    category_id: q.category_id,
    category_name: q.assessment_categories.name,
    question_code: q.question_code,
    question_text: q.question_text,
    question_type: q.question_type as QuestionType,
    max_score: q.max_score,
    evidence_mode: q.evidence_mode as AnswerExtra,
    comment_mode: q.comment_mode as AnswerExtra,
    options: q.options,
    guidance_note: q.guidance_note,
    score0_description: q.score0_description,
    score1_description: q.score1_description,
    score2_description: q.score2_description,
    score3_description: q.score3_description,
    sort_order: q.sort_order,
    is_active: q.is_active,
    created_at: q.created_at,
    updated_at: q.updated_at,
  };
}

export async function findQuestionById(
  id: string
): Promise<PublicQuestion | null> {
  const q = await prisma.assessment_questions.findFirst({
    where: { id, deleted_at: null },
    select: QUESTION_SELECT,
  });
  return q ? toPublicQuestion(q) : null;
}

export interface ListQuestionsFilters {
  templateId: string;
  categoryId?: string;
  isActive?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

export async function listQuestions(
  filters: ListQuestionsFilters
): Promise<{ rows: PublicQuestion[]; total: number }> {
  const where: Prisma.assessment_questionsWhereInput = {
    deleted_at: null,
    assessment_categories: { template_id: filters.templateId, deleted_at: null },
  };

  if (filters.categoryId) where.category_id = filters.categoryId;
  if (filters.isActive !== undefined) where.is_active = filters.isActive;
  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { question_text: { contains: s, mode: "insensitive" } },
      { question_code: { contains: s, mode: "insensitive" } },
      { guidance_note: { contains: s, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.assessment_questions.findMany({
      where,
      orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
      take: filters.limit,
      skip: filters.offset,
      select: QUESTION_SELECT,
    }),
    prisma.assessment_questions.count({ where }),
  ]);

  return { rows: rows.map(toPublicQuestion), total };
}

export interface OptionInput {
  optionText: string;
  score: number;
}

interface CreateQuestionParams {
  categoryId: string;
  questionCode: string | null;
  questionText: string;
  questionType: QuestionType;
  maxScore: number;
  evidenceMode: AnswerExtra;
  commentMode: AnswerExtra;
  options: OptionInput[];
  guidanceNote: string | null;
  score0Description: string | null;
  score1Description: string | null;
  score2Description: string | null;
  score3Description: string | null;
  sortOrder: number;
  isActive: boolean;
}

function optionRows(options: OptionInput[]): Prisma.assessment_question_optionsCreateWithoutQuestionInput[] {
  return options.map((o, i) => ({
    option_text: o.optionText,
    score: o.score,
    sort_order: i,
  }));
}

export async function createQuestion(
  p: CreateQuestionParams
): Promise<PublicQuestion> {
  const created = await prisma.assessment_questions.create({
    data: {
      category_id: p.categoryId,
      question_code: p.questionCode,
      question_text: p.questionText,
      question_type: p.questionType,
      max_score: p.maxScore,
      evidence_mode: p.evidenceMode,
      comment_mode: p.commentMode,
      guidance_note: p.guidanceNote,
      score0_description: p.score0Description,
      score1_description: p.score1Description,
      score2_description: p.score2Description,
      score3_description: p.score3Description,
      sort_order: p.sortOrder,
      is_active: p.isActive,
      options: { create: optionRows(p.options) },
    },
    select: QUESTION_SELECT,
  });
  return toPublicQuestion(created);
}

interface UpdateQuestionParams {
  categoryId?: string;
  questionCode?: string | null;
  questionText?: string;
  questionType?: QuestionType;
  maxScore?: number;
  evidenceMode?: AnswerExtra;
  commentMode?: AnswerExtra;
  options?: OptionInput[];
  guidanceNote?: string | null;
  score0Description?: string | null;
  score1Description?: string | null;
  score2Description?: string | null;
  score3Description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function updateQuestion(
  id: string,
  p: UpdateQuestionParams
): Promise<PublicQuestion | null> {
  const data: Prisma.assessment_questionsUncheckedUpdateManyInput = {};
  if (p.categoryId !== undefined) data.category_id = p.categoryId;
  if (p.questionCode !== undefined) data.question_code = p.questionCode;
  if (p.questionText !== undefined) data.question_text = p.questionText;
  if (p.questionType !== undefined) data.question_type = p.questionType;
  if (p.maxScore !== undefined) data.max_score = p.maxScore;
  if (p.evidenceMode !== undefined) data.evidence_mode = p.evidenceMode;
  if (p.commentMode !== undefined) data.comment_mode = p.commentMode;
  if (p.guidanceNote !== undefined) data.guidance_note = p.guidanceNote;
  if (p.score0Description !== undefined) data.score0_description = p.score0Description;
  if (p.score1Description !== undefined) data.score1_description = p.score1Description;
  if (p.score2Description !== undefined) data.score2_description = p.score2Description;
  if (p.score3Description !== undefined) data.score3_description = p.score3Description;
  if (p.sortOrder !== undefined) data.sort_order = p.sortOrder;
  if (p.isActive !== undefined) data.is_active = p.isActive;

  if (Object.keys(data).length === 0 && p.options === undefined) {
    return findQuestionById(id);
  }
  data.updated_at = new Date();

  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.assessment_questions.updateMany({
      where: { id, deleted_at: null },
      data,
    });
    if (!count) return false;
    // Answers keep pointing at the answer they chose, so old choices are only hidden.
    if (p.options !== undefined) {
      await tx.assessment_question_options.updateMany({
        where: { question_id: id, deleted_at: null },
        data: { deleted_at: new Date() },
      });
      if (p.options.length) {
        await tx.assessment_question_options.createMany({
          data: optionRows(p.options).map((o) => ({ ...o, question_id: id })),
        });
      }
    }
    return true;
  });

  if (!changed) return null;
  return findQuestionById(id);
}

export async function softDeleteQuestion(id: string): Promise<boolean> {
  const affected = await softDelete("assessment_questions", id);
  return affected > 0;
}

// Returns how many rows matched, so the caller can refuse ids from another template.
export async function reorderQuestions(
  templateId: string,
  items: { id: string; sortOrder: number }[]
): Promise<number> {
  if (items.length === 0) return 0;
  const now = new Date();
  const results = await prisma.$transaction(
    items.map((item) =>
      prisma.assessment_questions.updateMany({
        where: {
          id: item.id,
          deleted_at: null,
          assessment_categories: { template_id: templateId },
        },
        data: { sort_order: item.sortOrder, updated_at: now },
      })
    )
  );
  return results.reduce((sum, r) => sum + r.count, 0);
}

export async function maxSortOrderInCategory(
  categoryId: string
): Promise<number> {
  const res = await prisma.assessment_questions.aggregate({
    where: { category_id: categoryId, deleted_at: null },
    _max: { sort_order: true },
  });
  return res._max.sort_order ?? -1;
}

export interface CategoryFieldInput {
  // Missing on a field being added now.
  id?: string;
  questionCode: string | null;
  questionText: string;
  questionType: QuestionType;
  maxScore: number;
  evidenceMode: AnswerExtra;
  commentMode: AnswerExtra;
  isActive: boolean;
  options: OptionInput[];
}

/**
 * Writes a whole form in one go: the fields sent are added or updated in the
 * order they arrive, and any field left out of the list is removed.
 */
export async function replaceCategoryQuestions(
  categoryId: string,
  fields: CategoryFieldInput[]
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.assessment_questions.findMany({
        where: { category_id: categoryId, deleted_at: null },
        select: { id: true },
      });
      const keep = new Set(fields.map((f) => f.id).filter(Boolean) as string[]);

      for (const [index, field] of fields.entries()) {
        const data = {
          question_code: field.questionCode,
          question_text: field.questionText,
          question_type: field.questionType,
          max_score: field.maxScore,
          evidence_mode: field.evidenceMode,
          comment_mode: field.commentMode,
          sort_order: index,
          is_active: field.isActive,
          updated_at: now,
        };
        const id = field.id ?? randomUUID();
        if (field.id) {
          await tx.assessment_questions.updateMany({
            where: { id: field.id, category_id: categoryId, deleted_at: null },
            data,
          });
          // The answers a choice field offers are rewritten, so old ones are only hidden.
          await tx.assessment_question_options.updateMany({
            where: { question_id: field.id, deleted_at: null },
            data: { deleted_at: now },
          });
        } else {
          await tx.assessment_questions.create({
            data: { id, category_id: categoryId, ...data },
          });
        }
        if (field.options.length) {
          await tx.assessment_question_options.createMany({
            data: optionRows(field.options).map((o) => ({ ...o, question_id: id })),
          });
        }
      }

      const dropped = existing.filter((q) => !keep.has(q.id)).map((q) => q.id);
      if (dropped.length) {
        await tx.assessment_questions.updateMany({
          where: { id: { in: dropped } },
          data: { deleted_at: now, updated_at: now },
        });
      }
    },
    { timeout: 60_000, maxWait: 20_000 }
  );
}

export interface ImportQuestionRow {
  section: string;
  questionCode: string | null;
  questionText: string;
  questionType: QuestionType;
  maxScore: number;
  evidenceMode: AnswerExtra;
  commentMode: AnswerExtra;
  options: OptionInput[];
  guidanceNote: string | null;
  score0: string | null;
  score1: string | null;
  score2: string | null;
  score3: string | null;
}

/** Adds imported questions in one transaction, creating any category the rows name that does not exist yet. */
/** How many questions a template holds now, to tell a blank one from a filled one. */
export async function countTemplateQuestions(templateId: string): Promise<number> {
  return prisma.assessment_questions.count({
    where: { deleted_at: null, assessment_categories: { template_id: templateId, deleted_at: null } },
  });
}

/** The kind a blank template takes from the file that filled it. */
export async function setTemplateQuestionKind(
  templateId: string,
  kind: "mcq" | "input"
): Promise<void> {
  await prisma.assessment_templates.update({
    where: { id: templateId },
    data: { question_kind: kind, updated_at: new Date() },
  });
}

export async function importQuestions(
  templateId: string,
  rows: ImportQuestionRow[]
): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.assessment_categories.findMany({
        where: { template_id: templateId, deleted_at: null },
        select: { id: true, name: true, sort_order: true },
      });
      const categoryIds = new Map(existing.map((c) => [c.name.toLowerCase(), c.id]));
      let nextCategorySort = existing.reduce((max, c) => Math.max(max, c.sort_order), -1) + 1;

      for (const row of rows) {
        const key = row.section.toLowerCase();
        if (categoryIds.has(key)) continue;
        const id = randomUUID();
        await tx.assessment_categories.create({
          data: { id, template_id: templateId, name: row.section, sort_order: nextCategorySort, is_active: true },
        });
        nextCategorySort += 1;
        categoryIds.set(key, id);
      }

      const maxima = await tx.assessment_questions.groupBy({
        by: ["category_id"],
        where: { deleted_at: null, category_id: { in: [...categoryIds.values()] } },
        _max: { sort_order: true },
      });
      const nextSort = new Map(maxima.map((m) => [m.category_id, (m._max.sort_order ?? -1) + 1]));

      const data: Prisma.assessment_questionsCreateManyInput[] = [];
      const optionData: Prisma.assessment_question_optionsCreateManyInput[] = [];
      for (const row of rows) {
        const categoryId = categoryIds.get(row.section.toLowerCase());
        if (!categoryId) continue;
        const sort = nextSort.get(categoryId) ?? 0;
        nextSort.set(categoryId, sort + 1);
        const id = randomUUID();
        data.push({
          id,
          category_id: categoryId,
          question_code: row.questionCode,
          question_text: row.questionText,
          question_type: row.questionType,
          max_score: row.maxScore,
          evidence_mode: row.evidenceMode,
          comment_mode: row.commentMode,
          guidance_note: row.guidanceNote,
          score0_description: row.score0,
          score1_description: row.score1,
          score2_description: row.score2,
          score3_description: row.score3,
          sort_order: sort,
          is_active: true,
        });
        row.options.forEach((option, index) =>
          optionData.push({
            question_id: id,
            option_text: option.optionText,
            score: option.score,
            sort_order: index,
          })
        );
      }
      if (data.length) await tx.assessment_questions.createMany({ data });
      if (optionData.length) await tx.assessment_question_options.createMany({ data: optionData });
      return data.length;
    },
    { timeout: 60_000, maxWait: 20_000 }
  );
}
