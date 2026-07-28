import ApiError from "../utils/ApiError.js";
import {
  bulkImport,
  createCategory,
  createQuestion,
  findCategoryById,
  findQuestionById,
  listCategories,
  listQuestions,
  maxCategorySortOrder,
  maxSortOrderInCategory,
  reorderCategories,
  reorderQuestions,
  softDeleteCategory,
  softDeleteQuestion,
  updateCategory,
  updateQuestion,
  type ImportRow,
  type ListQuestionsFilters,
} from "../models/assessment.model.js";

const MAX_IMPORT_ROWS = 5000;

export async function getCategories() {
  return listCategories();
}

export async function getCategoryById(id: string) {
  const cat = await findCategoryById(id);
  if (!cat) throw ApiError.notFound("Category not found.");
  return cat;
}

export async function addCategory(body: {
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const maxOrder = await maxCategorySortOrder();
  return createCategory({
    name: body.name,
    description: body.description ?? null,
    sortOrder: body.sortOrder ?? maxOrder + 1,
    isActive: body.isActive ?? true,
  });
}

export async function editCategory(
  id: string,
  body: {
    name?: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }
) {
  await getCategoryById(id);
  const updated = await updateCategory(id, {
    name: body.name,
    description: body.description,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  });
  if (!updated) throw ApiError.notFound("Category not found.");
  return updated;
}

export async function removeCategory(id: string) {
  await getCategoryById(id);
  const ok = await softDeleteCategory(id);
  if (!ok) throw ApiError.notFound("Category not found.");
}

export async function orderCategories(
  items: { id: string; sortOrder: number }[]
) {
  const updated = await reorderCategories(items);
  if (updated < items.length) {
    throw ApiError.notFound(
      "One or more categories could not be found. Refresh and try again."
    );
  }
}

export async function getQuestions(filters: ListQuestionsFilters) {
  return listQuestions(filters);
}

export async function getQuestionById(id: string) {
  const q = await findQuestionById(id);
  if (!q) throw ApiError.notFound("Question not found.");
  return q;
}

export async function addQuestion(body: {
  categoryId: string;
  questionCode?: string | null;
  questionText: string;
  guidanceNote?: string | null;
  score0Description?: string | null;
  score1Description?: string | null;
  score2Description?: string | null;
  score3Description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const cat = await findCategoryById(body.categoryId);
  if (!cat) throw ApiError.notFound("Category not found.");

  const maxOrder = await maxSortOrderInCategory(body.categoryId);
  return createQuestion({
    categoryId: body.categoryId,
    questionCode: body.questionCode ?? null,
    questionText: body.questionText,
    guidanceNote: body.guidanceNote ?? null,
    score0Description: body.score0Description ?? null,
    score1Description: body.score1Description ?? null,
    score2Description: body.score2Description ?? null,
    score3Description: body.score3Description ?? null,
    sortOrder: body.sortOrder ?? maxOrder + 1,
    isActive: body.isActive ?? true,
  });
}

export async function editQuestion(
  id: string,
  body: {
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
) {
  await getQuestionById(id);
  if (body.categoryId) {
    const cat = await findCategoryById(body.categoryId);
    if (!cat) throw ApiError.notFound("Category not found.");
  }
  const updated = await updateQuestion(id, body);
  if (!updated) throw ApiError.notFound("Question not found.");
  return updated;
}

export async function removeQuestion(id: string) {
  await getQuestionById(id);
  const ok = await softDeleteQuestion(id);
  if (!ok) throw ApiError.notFound("Question not found.");
}

export async function orderQuestions(
  items: { id: string; sortOrder: number }[]
) {
  const updated = await reorderQuestions(items);
  if (updated < items.length) {
    throw ApiError.notFound(
      "One or more questions could not be found. Refresh and try again."
    );
  }
}

interface ExcelRow {
  QuestionCode?: string;
  Section?: string;
  QuestionText?: string;
  GuidanceNote?: string;
  Score0Description?: string;
  Score1Description?: string;
  Score2Description?: string;
  Score3Description?: string;
}

function cell(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function importQuestionsFromRows(rows: ExcelRow[]) {
  if (!rows.length) throw ApiError.badRequest("No rows found in the file.");
  if (rows.length > MAX_IMPORT_ROWS) {
    throw ApiError.badRequest(
      `This file has too many rows (${rows.length}). The limit is ${MAX_IMPORT_ROWS}. Please split it.`
    );
  }

  const valid: ImportRow[] = [];
  let skipped = 0;
  for (const row of rows) {
    const section = row.Section?.trim();
    const text = row.QuestionText?.trim();
    if (!section || !text) {
      skipped++;
      continue;
    }
    valid.push({
      section,
      questionText: text,
      questionCode: cell(row.QuestionCode),
      guidanceNote: cell(row.GuidanceNote),
      score0: cell(row.Score0Description),
      score1: cell(row.Score1Description),
      score2: cell(row.Score2Description),
      score3: cell(row.Score3Description),
    });
  }

  if (!valid.length) {
    throw ApiError.badRequest(
      "No valid rows found. Each row needs at least a Section and a QuestionText."
    );
  }

  const { created } = await bulkImport(valid);
  return { created, skipped };
}
