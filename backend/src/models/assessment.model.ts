import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";

type Tx = Prisma.TransactionClient | typeof prisma;

async function applyReorder(
  table: "assessment_categories" | "assessment_questions",
  items: { id: string; sortOrder: number }[]
): Promise<void> {
  if (items.length === 0) return;

  await prisma.$transaction(
    items.map((item) =>
      table === "assessment_categories"
        ? prisma.assessment_categories.updateMany({
            where: { id: item.id, deleted_at: null },
            data: { sort_order: item.sortOrder, updated_at: new Date() },
          })
        : prisma.assessment_questions.updateMany({
            where: { id: item.id, deleted_at: null },
            data: { sort_order: item.sortOrder, updated_at: new Date() },
          })
    )
  );
}

export interface PublicCategory {
  id: string;
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

export async function listCategories(): Promise<PublicCategory[]> {
  const rows = await prisma.assessment_categories.findMany({
    where: { deleted_at: null },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: CATEGORY_SELECT,
  });
  return rows.map(toPublicCategory);
}

interface CreateCategoryParams {
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

export async function softDeleteCategory(id: string): Promise<boolean> {
  const affected = await softDelete("assessment_categories", id);
  return affected > 0;
}

export async function upsertCategoryByName(
  name: string,
  sortOrder: number,
  tx: Tx = prisma
): Promise<string> {
  const inserted = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      INSERT INTO assessment_categories (name, sort_order, is_active)
      VALUES (${name}, ${sortOrder}, true)
      ON CONFLICT (LOWER(name)) WHERE deleted_at IS NULL DO NOTHING
      RETURNING id;`
  );
  if (inserted[0]) return inserted[0].id;

  const existing = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM assessment_categories
       WHERE LOWER(name) = LOWER(${name}) AND deleted_at IS NULL
       LIMIT 1;`
  );
  return existing[0].id;
}

export async function reorderCategories(
  items: { id: string; sortOrder: number }[]
): Promise<void> {
  await applyReorder("assessment_categories", items);
}

export interface PublicQuestion {
  id: string;
  category_id: string;
  category_name: string;
  question_code: string | null;
  question_text: string;
  guidance_note: string | null;
  score0_description: string | null;
  score1_description: string | null;
  score2_description: string | null;
  score3_description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const QUESTION_SELECT = {
  id: true,
  category_id: true,
  question_code: true,
  question_text: true,
  guidance_note: true,
  score0_description: true,
  score1_description: true,
  score2_description: true,
  score3_description: true,
  sort_order: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  assessment_categories: { select: { name: true } },
} satisfies Prisma.assessment_questionsSelect;

type QuestionRow = Prisma.assessment_questionsGetPayload<{
  select: typeof QUESTION_SELECT;
}>;

function toPublicQuestion(q: QuestionRow): PublicQuestion {
  return {
    id: q.id,
    category_id: q.category_id,
    category_name: q.assessment_categories.name,
    question_code: q.question_code,
    question_text: q.question_text,
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
  categoryId?: string;
  isActive?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

export async function listQuestions(
  filters: ListQuestionsFilters
): Promise<{ rows: PublicQuestion[]; total: number }> {
  const where: Prisma.assessment_questionsWhereInput = { deleted_at: null };

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

export async function listQuestionsByCategory(
  categoryId: string
): Promise<PublicQuestion[]> {
  const rows = await prisma.assessment_questions.findMany({
    where: { category_id: categoryId, deleted_at: null, is_active: true },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: QUESTION_SELECT,
  });
  return rows.map(toPublicQuestion);
}

interface CreateQuestionParams {
  categoryId: string;
  questionCode: string | null;
  questionText: string;
  guidanceNote: string | null;
  score0Description: string | null;
  score1Description: string | null;
  score2Description: string | null;
  score3Description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export async function createQuestion(
  p: CreateQuestionParams
): Promise<PublicQuestion> {
  const created = await prisma.assessment_questions.create({
    data: {
      category_id: p.categoryId,
      question_code: p.questionCode,
      question_text: p.questionText,
      guidance_note: p.guidanceNote,
      score0_description: p.score0Description,
      score1_description: p.score1Description,
      score2_description: p.score2Description,
      score3_description: p.score3Description,
      sort_order: p.sortOrder,
      is_active: p.isActive,
    },
    select: QUESTION_SELECT,
  });
  return toPublicQuestion(created);
}

interface UpdateQuestionParams {
  categoryId?: string;
  questionCode?: string | null;
  questionText?: string;
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
  if (p.guidanceNote !== undefined) data.guidance_note = p.guidanceNote;
  if (p.score0Description !== undefined) data.score0_description = p.score0Description;
  if (p.score1Description !== undefined) data.score1_description = p.score1Description;
  if (p.score2Description !== undefined) data.score2_description = p.score2Description;
  if (p.score3Description !== undefined) data.score3_description = p.score3Description;
  if (p.sortOrder !== undefined) data.sort_order = p.sortOrder;
  if (p.isActive !== undefined) data.is_active = p.isActive;

  if (Object.keys(data).length === 0) return findQuestionById(id);
  data.updated_at = new Date();

  const { count } = await prisma.assessment_questions.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findQuestionById(id);
}

export async function softDeleteQuestion(id: string): Promise<boolean> {
  const affected = await softDelete("assessment_questions", id);
  return affected > 0;
}

export async function reorderQuestions(
  items: { id: string; sortOrder: number }[]
): Promise<void> {
  await applyReorder("assessment_questions", items);
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

export async function maxCategorySortOrder(): Promise<number> {
  const res = await prisma.assessment_categories.aggregate({
    where: { deleted_at: null },
    _max: { sort_order: true },
  });
  return res._max.sort_order ?? -1;
}

export interface ImportRow {
  section: string;
  questionText: string;
  questionCode: string | null;
  guidanceNote: string | null;
  score0: string | null;
  score1: string | null;
  score2: string | null;
  score3: string | null;
}

export async function bulkImport(
  rows: ImportRow[]
): Promise<{ created: number }> {
  return prisma.$transaction(async (tx) => {
    const cats = new Map<string, { id: string; nextSort: number }>();

    const maxCat = await tx.assessment_categories.aggregate({
      where: { deleted_at: null },
      _max: { sort_order: true },
    });
    let nextCatSort = (maxCat._max.sort_order ?? -1) + 1;

    for (const row of rows) {
      const key = row.section.toLowerCase();
      if (cats.has(key)) continue;
      const id = await upsertCategoryByName(row.section, nextCatSort, tx);
      nextCatSort++;
      const maxQ = await tx.assessment_questions.aggregate({
        where: { category_id: id, deleted_at: null },
        _max: { sort_order: true },
      });
      cats.set(key, { id, nextSort: (maxQ._max.sort_order ?? -1) + 1 });
    }

    let created = 0;
    for (const row of rows) {
      const cat = cats.get(row.section.toLowerCase());
      if (!cat) continue;
      await tx.assessment_questions.create({
        data: {
          category_id: cat.id,
          question_code: row.questionCode,
          question_text: row.questionText,
          guidance_note: row.guidanceNote,
          score0_description: row.score0,
          score1_description: row.score1,
          score2_description: row.score2,
          score3_description: row.score3,
          sort_order: cat.nextSort,
          is_active: true,
        },
      });
      cat.nextSort++;
      created++;
    }

    return { created };
  });
}
