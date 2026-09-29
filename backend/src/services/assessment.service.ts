import ApiError from "../utils/ApiError.js";
import { broadcastToAdmins } from "./realtime.service.js";
import type { PublicAssessmentTemplate } from "../models/assessmentTemplate.model.js";
import {
  addTemplate,
  getVisibleTemplate,
  getEditableTemplate,
  removeTemplate,
  type TemplateActor,
} from "./assessmentTemplate.service.js";
import {
  readImportWorkbook,
  buildTemplateExport,
  buildFormExport,
  IMPORT_TYPE_WORDS,
  IMPORT_EXTRA_WORDS,
} from "./assessmentImport.js";
import {
  importRowSchema,
  type AnswerExtra,
  type QuestionType,
} from "../validators/assessment.schema.js";
import {
  categoryNameTaken,
  createCategory,
  createQuestion,
  findCategoryById,
  findQuestionById,
  countTemplateQuestions,
  importQuestions,
  setTemplateQuestionKind,
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
  replaceCategoryQuestions,
  type CategoryFieldInput,
  type ImportQuestionRow,
  type OptionInput,
  type PublicCategory,
  type PublicQuestion,
} from "../models/assessment.model.js";

const MAX_IMPORT_ROWS = 5000;
const MAX_REPORTED_PROBLEMS = 50;

function notify(): void {
  broadcastToAdmins("assessments");
}

// ------------------------------- Categories --------------------------------

export async function getTemplateCategories(
  templateId: string,
  actor: TemplateActor
): Promise<PublicCategory[]> {
  await getVisibleTemplate(templateId, actor);
  return listCategories(templateId);
}

export async function getCategory(id: string, actor: TemplateActor): Promise<PublicCategory> {
  const category = await findCategoryById(id);
  if (!category) throw ApiError.notFound("Category not found.");
  await getVisibleTemplate(category.template_id, actor);
  return category;
}

export async function addCategory(
  templateId: string,
  actor: TemplateActor,
  body: { name: string; description?: string | null; sortOrder?: number; isActive?: boolean }
): Promise<PublicCategory> {
  await getEditableTemplate(templateId, actor);
  const name = body.name.trim();
  if (await categoryNameTaken(templateId, name)) {
    throw ApiError.conflict(`This template already has a category named "${name}".`);
  }
  const maxOrder = await maxCategorySortOrder(templateId);
  const created = await createCategory({
    templateId,
    name,
    description: body.description?.trim() || null,
    sortOrder: body.sortOrder ?? maxOrder + 1,
    isActive: body.isActive ?? true,
  });
  notify();
  return created;
}

export async function editCategory(
  id: string,
  actor: TemplateActor,
  body: { name?: string; description?: string | null; sortOrder?: number; isActive?: boolean }
): Promise<PublicCategory> {
  const existing = await findCategoryById(id);
  if (!existing) throw ApiError.notFound("Category not found.");
  await getEditableTemplate(existing.template_id, actor);
  const name = body.name?.trim();
  if (name !== undefined && (await categoryNameTaken(existing.template_id, name, id))) {
    throw ApiError.conflict(`This template already has a category named "${name}".`);
  }
  const updated = await updateCategory(id, {
    name,
    description: body.description === undefined ? undefined : body.description?.trim() || null,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  });
  if (!updated) throw ApiError.notFound("Category not found.");
  notify();
  return updated;
}

export async function removeCategory(id: string, actor: TemplateActor): Promise<void> {
  const existing = await findCategoryById(id);
  if (!existing) throw ApiError.notFound("Category not found.");
  await getEditableTemplate(existing.template_id, actor);
  const ok = await softDeleteCategory(id);
  if (!ok) throw ApiError.notFound("Category not found.");
  notify();
}

export async function orderCategories(
  templateId: string,
  actor: TemplateActor,
  items: { id: string; sortOrder: number }[]
): Promise<void> {
  await getEditableTemplate(templateId, actor);
  const updated = await reorderCategories(templateId, items);
  if (updated < items.length) {
    throw ApiError.notFound("One or more categories could not be found in this template. Refresh and try again.");
  }
  notify();
}

// -------------------------------- Questions --------------------------------

export async function getTemplateQuestions(
  templateId: string,
  actor: TemplateActor,
  filters: { categoryId?: string; isActive?: boolean; search?: string; limit: number; offset: number }
): Promise<{ rows: PublicQuestion[]; total: number }> {
  await getVisibleTemplate(templateId, actor);
  return listQuestions({ templateId, ...filters });
}

export async function getQuestion(id: string, actor: TemplateActor): Promise<PublicQuestion> {
  const question = await findQuestionById(id);
  if (!question) throw ApiError.notFound("Question not found.");
  await getVisibleTemplate(question.template_id, actor);
  return question;
}

interface QuestionBody {
  questionCode?: string | null;
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

// What a question of this type is allowed to carry: only a multiple choice
// question has answers to pick from, and the 0 to 3 question always tops out at 3.
function settleType(
  type: QuestionType,
  given: { maxScore?: number; options?: OptionInput[] },
  current?: { maxScore: number; options: OptionInput[] }
): { maxScore: number; options: OptionInput[] | undefined } {
  if (type === "mcq") {
    const options = given.options ?? current?.options ?? [];
    if (options.length < 2) {
      throw ApiError.badRequest("A multiple choice question needs at least two answers.");
    }
    const highest = options.reduce((max, o) => Math.max(max, o.score), 0);
    const maxScore = given.maxScore ?? Math.max(highest, 1);
    if (highest > maxScore) {
      throw ApiError.badRequest("An answer cannot score more than the highest score of the question.");
    }
    return { maxScore, options: given.options };
  }

  if (given.options?.length) {
    throw ApiError.badRequest("Only a multiple choice question can have answers to choose from.");
  }
  // Answers left behind by a question that used to be multiple choice.
  const options = current?.options.length ? [] : given.options;
  if (type === "scored") return { maxScore: 3, options };
  return { maxScore: given.maxScore ?? current?.maxScore ?? 3, options };
}

async function assertCategoryInTemplate(categoryId: string, templateId: string): Promise<void> {
  const category = await findCategoryById(categoryId);
  if (!category || category.template_id !== templateId) {
    throw ApiError.badRequest("Choose a category from this template.");
  }
}

export async function addQuestion(
  templateId: string,
  actor: TemplateActor,
  body: QuestionBody & { categoryId: string; questionText: string }
): Promise<PublicQuestion> {
  await getEditableTemplate(templateId, actor);
  await assertCategoryInTemplate(body.categoryId, templateId);
  const maxOrder = await maxSortOrderInCategory(body.categoryId);
  const type = body.questionType ?? "scored";
  const settled = settleType(type, body);
  const scored = type === "scored";
  const created = await createQuestion({
    categoryId: body.categoryId,
    questionCode: body.questionCode?.trim() || null,
    questionText: body.questionText.trim(),
    questionType: type,
    maxScore: settled.maxScore,
    evidenceMode: body.evidenceMode ?? "off",
    commentMode: body.commentMode ?? "off",
    options: settled.options ?? [],
    guidanceNote: body.guidanceNote ?? null,
    score0Description: scored ? body.score0Description ?? null : null,
    score1Description: scored ? body.score1Description ?? null : null,
    score2Description: scored ? body.score2Description ?? null : null,
    score3Description: scored ? body.score3Description ?? null : null,
    sortOrder: body.sortOrder ?? maxOrder + 1,
    isActive: body.isActive ?? true,
  });
  notify();
  return created;
}

export async function editQuestion(
  id: string,
  actor: TemplateActor,
  body: QuestionBody & { categoryId?: string; questionText?: string }
): Promise<PublicQuestion> {
  const existing = await findQuestionById(id);
  if (!existing) throw ApiError.notFound("Question not found.");
  await getEditableTemplate(existing.template_id, actor);
  if (body.categoryId && body.categoryId !== existing.category_id) {
    await assertCategoryInTemplate(body.categoryId, existing.template_id);
  }
  const type = body.questionType ?? existing.question_type;
  const settled = settleType(type, body, {
    maxScore: existing.max_score,
    options: existing.options.map((o) => ({ optionText: o.option_text, score: o.score })),
  });
  // A question that is no longer scored 0 to 3 keeps no score wording.
  const dropDescriptions = type !== "scored" && existing.question_type === "scored";
  const updated = await updateQuestion(id, {
    ...body,
    questionText: body.questionText?.trim(),
    questionCode: body.questionCode === undefined ? undefined : body.questionCode?.trim() || null,
    questionType: type,
    maxScore: settled.maxScore,
    options: settled.options,
    score0Description: dropDescriptions ? null : body.score0Description,
    score1Description: dropDescriptions ? null : body.score1Description,
    score2Description: dropDescriptions ? null : body.score2Description,
    score3Description: dropDescriptions ? null : body.score3Description,
  });
  if (!updated) throw ApiError.notFound("Question not found.");
  notify();
  return updated;
}

export async function removeQuestion(id: string, actor: TemplateActor): Promise<void> {
  const existing = await findQuestionById(id);
  if (!existing) throw ApiError.notFound("Question not found.");
  await getEditableTemplate(existing.template_id, actor);
  const ok = await softDeleteQuestion(id);
  if (!ok) throw ApiError.notFound("Question not found.");
  notify();
}

export async function orderQuestions(
  templateId: string,
  actor: TemplateActor,
  items: { id: string; sortOrder: number }[]
): Promise<void> {
  await getEditableTemplate(templateId, actor);
  const updated = await reorderQuestions(templateId, items);
  if (updated < items.length) {
    throw ApiError.notFound("One or more questions could not be found in this template. Refresh and try again.");
  }
  notify();
}

/**
 * Saves a category as one form: the fields arrive in the order they are shown,
 * a field with no id is new, and a field left out of the list is removed.
 */
export async function saveCategoryFields(
  templateId: string,
  categoryId: string,
  actor: TemplateActor,
  fields: (QuestionBody & { id?: string; questionText: string })[]
): Promise<PublicQuestion[]> {
  await getEditableTemplate(templateId, actor);
  await assertCategoryInTemplate(categoryId, templateId);

  const current = await listQuestions({ templateId, categoryId, limit: 500, offset: 0 });
  const byId = new Map(current.rows.map((q) => [q.id, q]));

  const rows: CategoryFieldInput[] = fields.map((field) => {
    if (field.id && !byId.has(field.id)) {
      throw ApiError.badRequest("One of the fields is not part of this form. Refresh and try again.");
    }
    const existing = field.id ? byId.get(field.id) : undefined;
    const type = field.questionType ?? existing?.question_type ?? "text";
    const settled = settleType(
      type,
      field,
      existing
        ? {
            maxScore: existing.max_score,
            options: existing.options.map((o) => ({ optionText: o.option_text, score: o.score })),
          }
        : undefined
    );
    return {
      id: field.id,
      questionCode: field.questionCode?.trim() || null,
      questionText: field.questionText.trim(),
      questionType: type,
      maxScore: settled.maxScore,
      evidenceMode: field.evidenceMode ?? existing?.evidence_mode ?? "off",
      commentMode: field.commentMode ?? existing?.comment_mode ?? "off",
      isActive: field.isActive ?? existing?.is_active ?? true,
      options:
        settled.options ??
        (existing?.options ?? []).map((o) => ({ optionText: o.option_text, score: o.score })),
    };
  });

  await replaceCategoryQuestions(categoryId, rows);
  notify();
  const saved = await listQuestions({ templateId, categoryId, limit: 500, offset: 0 });
  return saved.rows;
}

/** The whole assessment as a spreadsheet in the import format. */
export async function exportTemplateQuestions(
  templateId: string,
  actor: TemplateActor
): Promise<{ fileName: string; file: Buffer }> {
  const template = await getVisibleTemplate(templateId, actor);
  const { rows } = await listQuestions({ templateId, limit: 5000, offset: 0 });
  const categories = await listCategories(templateId);
  const order = new Map(categories.map((c, index) => [c.id, index]));

  const sorted = [...rows].sort((a, b) => {
    const byCategory = (order.get(a.category_id) ?? 0) - (order.get(b.category_id) ?? 0);
    return byCategory !== 0 ? byCategory : a.sort_order - b.sort_order;
  });

  const asRow = (q: (typeof sorted)[number]) => ({
    section: q.category_name,
    questionCode: q.question_code,
    questionText: q.question_text,
    questionType: q.question_type,
    maxScore: q.max_score,
    evidenceMode: q.evidence_mode,
    commentMode: q.comment_mode,
    guidanceNote: q.guidance_note,
    score0Description: q.score0_description,
    score1Description: q.score1_description,
    score2Description: q.score2_description,
    score3Description: q.score3_description,
    options: q.options.map((o) => ({ option_text: o.option_text, score: o.score })),
  });

  // An input based assessment reads as forms, one sheet per category.
  const file =
    template.question_kind === "input"
      ? await buildFormExport(
          categories.map((category) => ({
            name: category.name,
            fields: sorted.filter((q) => q.category_id === category.id).map(asRow),
          }))
        )
      : await buildTemplateExport(sorted.map(asRow));

  // A file name the person recognises, with anything a file system dislikes taken out.
  const safeName = template.name.replace(/[^\w\s-]/g, "").trim() || "assessment";
  return { fileName: `${safeName}.xlsx`, file };
}

// --------------------------------- Import ----------------------------------

export interface ImportProblem {
  // Where it went wrong: "Row 7", or "Trainings, column B" in a form.
  where: string;
  message: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  problems: ImportProblem[];
}

// "No till = 3 | Reduced till = 2" as the spreadsheet writes the answers of a multiple choice question.
function parseAnswers(text: string): OptionInput[] {
  return text
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.lastIndexOf("=");
      if (at < 0) return { optionText: part, score: 0 };
      return {
        optionText: part.slice(0, at).trim(),
        score: Number(part.slice(at + 1).trim()),
      };
    });
}

/** Checks access first, then every row, and adds the valid ones in one transaction. */
export async function importQuestionsIntoTemplate(
  templateId: string,
  actor: TemplateActor,
  file: Buffer
): Promise<ImportResult> {
  const template = await getEditableTemplate(templateId, actor);

  const sheet = readImportWorkbook(file);
  if (!sheet) throw ApiError.badRequest("Excel file has no sheets.");
  if (sheet.missingColumns.length) {
    throw ApiError.badRequest(
      `The first row must hold the column headers. Missing: ${sheet.missingColumns.join(", ")}. Download the empty template to get them right.`
    );
  }

  // A row with nothing in it is not a mistake, just an empty line.
  const filled = sheet.rows.filter((r) => Object.values(r.cells).some((v) => v !== ""));
  if (!filled.length) throw ApiError.badRequest("No rows found in the file.");
  if (filled.length > MAX_IMPORT_ROWS) {
    throw ApiError.badRequest(
      `This file has too many rows (${filled.length}). The limit is ${MAX_IMPORT_ROWS}. Please split it.`
    );
  }

  const valid: ImportQuestionRow[] = [];
  // A sheet the reader left out on purpose counts as skipped too.
  const problems: ImportProblem[] = [...sheet.notes];

  // A row that leaves the type out follows what the template holds.
  const fallbackType = template.question_kind === "mcq" ? "mcq" : template.question_kind === "input" ? "text" : "scored";

  for (const { where, cells } of filled) {
    const typeWord = cells.answerType.trim().toLowerCase();
    const type = typeWord === "" ? fallbackType : IMPORT_TYPE_WORDS[typeWord];
    if (!type) {
      problems.push({
        where,
        message: `"${cells.answerType}" is not an answer type. Use Multiple choice, Short text, Description, Number, Date or Yes or No.`,
      });
      continue;
    }
    const evidence = IMPORT_EXTRA_WORDS[cells.evidence.trim().toLowerCase()];
    const description = IMPORT_EXTRA_WORDS[cells.description.trim().toLowerCase()];
    if (!evidence || !description) {
      problems.push({
        where,
        message: "Evidence and Description take Off, Optional or Required.",
      });
      continue;
    }
    const parsed = importRowSchema.safeParse({
      section: cells.section,
      questionCode: cells.questionCode || null,
      questionText: cells.questionText,
      questionType: type,
      maxScore: cells.maxScore || undefined,
      evidenceMode: evidence,
      commentMode: description,
      options: cells.answers ? parseAnswers(cells.answers) : undefined,
      guidanceNote: cells.guidanceNote || null,
      score0Description: cells.score0 || null,
      score1Description: cells.score1 || null,
      score2Description: cells.score2 || null,
      score3Description: cells.score3 || null,
    });
    if (!parsed.success) {
      problems.push({ where, message: parsed.error.issues[0]?.message ?? "This row is not valid." });
      continue;
    }
    // A section the template does not have yet becomes a new category.
    const row = parsed.data;
    let settled: { maxScore: number; options: OptionInput[] | undefined };
    try {
      settled = settleType(row.questionType, { maxScore: row.maxScore, options: row.options });
    } catch (err) {
      problems.push({ where, message: (err as { message?: string }).message ?? "This row is not valid." });
      continue;
    }
    const scored = row.questionType === "scored";
    valid.push({
      section: row.section,
      questionCode: row.questionCode ?? null,
      questionText: row.questionText,
      questionType: row.questionType,
      maxScore: settled.maxScore,
      evidenceMode: row.evidenceMode ?? "off",
      commentMode: row.commentMode ?? "off",
      options: settled.options ?? [],
      guidanceNote: row.guidanceNote ?? null,
      score0: scored ? row.score0Description ?? null : null,
      score1: scored ? row.score1Description ?? null : null,
      score2: scored ? row.score2Description ?? null : null,
      score3: scored ? row.score3Description ?? null : null,
    });
  }

  const reported = problems.slice(0, MAX_REPORTED_PROBLEMS);
  if (!valid.length) {
    throw ApiError.badRequest(
      `Nothing could be imported. ${reported.slice(0, 3).map((p) => `${p.where}: ${p.message}`).join(" ")}`,
      reported.map((p) => ({ field: p.where, message: p.message }))
    );
  }

  const wasEmpty = (await countTemplateQuestions(templateId)) === 0;
  const created = await importQuestions(templateId, valid);

  // A blank template takes its kind from the file that filled it.
  if (template.question_kind === null && wasEmpty && created > 0) {
    await setTemplateQuestionKind(templateId, sheet.shape === "form" ? "input" : "mcq");
  }

  notify();
  return { created, skipped: problems.length, problems: reported };
}

export interface ImportedTemplate extends ImportResult {
  template: PublicAssessmentTemplate;
}

/**
 * A new template built from a spreadsheet: the name comes from the admin, the
 * questions and the kind come from the file. Nothing is left behind when the
 * file turns out to be unusable.
 */
export async function createTemplateFromFile(
  actor: TemplateActor,
  name: string,
  file: Buffer
): Promise<ImportedTemplate> {
  // Read it first, so a file that cannot be used never leaves an empty template.
  const sheet = readImportWorkbook(file);
  if (!sheet) throw ApiError.badRequest("Excel file has no sheets.");
  if (!sheet.rows.some((r) => Object.values(r.cells).some((v) => v !== ""))) {
    const note = sheet.notes[0];
    throw ApiError.badRequest(
      note ? `${note.where}: ${note.message}` : "No fields found in the file."
    );
  }

  const template = await addTemplate(actor, { name, basedOn: "blank" });
  try {
    const result = await importQuestionsIntoTemplate(template.id, actor, file);
    return { ...result, template: await getVisibleTemplate(template.id, actor) };
  } catch (err) {
    await removeTemplate(template.id, actor);
    throw err;
  }
}
