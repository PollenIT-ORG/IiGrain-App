import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { actorOf } from "./assessmentTemplate.controller.js";
import { buildImportSample } from "../services/assessmentImport.js";
import {
  addCategory,
  editCategory,
  getCategory as findCategory,
  getTemplateCategories,
  orderCategories,
  removeCategory,
  addQuestion,
  editQuestion,
  getQuestion as findQuestion,
  getTemplateQuestions,
  orderQuestions,
  removeQuestion,
  createTemplateFromFile,
  importQuestionsIntoTemplate,
  exportTemplateQuestions,
  saveCategoryFields,
} from "../services/assessment.service.js";
import type {
  CreateCategoryBody,
  UpdateCategoryBody,
  CreateQuestionBody,
  UpdateQuestionBody,
  ReorderBody,
  ListQuestionsQuery,
  SaveCategoryFieldsBody,
} from "../validators/assessment.schema.js";

export const listTemplateCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await getTemplateCategories(req.params.id, actorOf(req));
  ApiResponse.send(res, 200, "Categories fetched.", { categories });
});

export const createTemplateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await addCategory(req.params.id, actorOf(req), req.body as CreateCategoryBody);
  ApiResponse.send(res, 201, "Category created.", { category });
});

export const reorderTemplateCategories = asyncHandler(async (req: Request, res: Response) => {
  await orderCategories(req.params.id, actorOf(req), (req.body as ReorderBody).items);
  ApiResponse.send(res, 200, "Categories reordered.");
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await findCategory(req.params.id, actorOf(req));
  ApiResponse.send(res, 200, "Category fetched.", { category });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await editCategory(req.params.id, actorOf(req), req.body as UpdateCategoryBody);
  ApiResponse.send(res, 200, "Category updated.", { category });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await removeCategory(req.params.id, actorOf(req));
  ApiResponse.send(res, 200, "Category deleted.");
});

// A whole form of one category, saved in one go.
export const saveTemplateCategoryFields = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SaveCategoryFieldsBody;
  const questions = await saveCategoryFields(
    req.params.id,
    req.params.categoryId,
    actorOf(req),
    body.fields
  );
  ApiResponse.send(res, 200, "Form saved.", { questions });
});

export const listTemplateQuestions = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListQuestionsQuery;
  const result = await getTemplateQuestions(req.params.id, actorOf(req), {
    categoryId: q.categoryId,
    isActive: q.isActive,
    search: q.search,
    limit: q.limit,
    offset: (q.page - 1) * q.limit,
  });
  ApiResponse.send(res, 200, "Questions fetched.", {
    questions: result.rows,
    meta: {
      page: q.page,
      limit: q.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / q.limit),
    },
  });
});

export const createTemplateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await addQuestion(req.params.id, actorOf(req), req.body as CreateQuestionBody);
  ApiResponse.send(res, 201, "Question created.", { question });
});

export const reorderTemplateQuestions = asyncHandler(async (req: Request, res: Response) => {
  await orderQuestions(req.params.id, actorOf(req), (req.body as ReorderBody).items);
  ApiResponse.send(res, 200, "Questions reordered.");
});

export const getQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await findQuestion(req.params.id, actorOf(req));
  ApiResponse.send(res, 200, "Question fetched.", { question });
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await editQuestion(req.params.id, actorOf(req), req.body as UpdateQuestionBody);
  ApiResponse.send(res, 200, "Question updated.", { question });
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  await removeQuestion(req.params.id, actorOf(req));
  ApiResponse.send(res, 200, "Question deleted.");
});

function looksLikeSpreadsheet(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  const zip = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  const ole =
    buf.length >= 8 &&
    buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 &&
    buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1;
  return zip || ole;
}

export const importTemplateQuestions = asyncHandler(async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw ApiError.badRequest("No file uploaded. Please attach an Excel file.");
  if (!looksLikeSpreadsheet(file.buffer)) {
    throw ApiError.badRequest(
      "That doesn't look like a valid Excel file. Please upload a .xlsx or .xls file."
    );
  }
  const result = await importQuestionsIntoTemplate(req.params.id, actorOf(req), file.buffer);
  ApiResponse.send(
    res,
    result.created > 0 ? 201 : 200,
    `Import complete. ${result.created} question(s) created, ${result.skipped} skipped.`,
    result
  );
});

// A new template straight from a spreadsheet, named by whoever imports it.
export const importTemplateFromFile = asyncHandler(async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw ApiError.badRequest("No file uploaded. Please attach an Excel file.");
  if (!looksLikeSpreadsheet(file.buffer)) {
    throw ApiError.badRequest(
      "That doesn't look like a valid Excel file. Please upload a .xlsx or .xls file."
    );
  }
  const name = String((req.body as { name?: unknown }).name ?? "").trim();
  if (name.length < 2) throw ApiError.badRequest("Give the template a name of at least two characters.");
  if (name.length > 150) throw ApiError.badRequest("The name must be 150 characters or fewer.");

  const result = await createTemplateFromFile(actorOf(req), name, file.buffer);
  ApiResponse.send(
    res,
    201,
    `Template created. ${result.created} question(s) imported, ${result.skipped} skipped.`,
    result
  );
});

// This assessment written out, so it can be edited in Excel and imported again.
export const downloadTemplateQuestions = asyncHandler(async (req: Request, res: Response) => {
  const { fileName, file } = await exportTemplateQuestions(req.params.id, actorOf(req));
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(file);
});

export const downloadImportSample = asyncHandler(async (req: Request, res: Response) => {
  // The examples follow the kind asked for; without one the file shows both.
  const asked = (req.query as { kind?: string }).kind;
  const kind = asked === "mcq" || asked === "input" ? asked : undefined;
  const name = kind ? `assessment-${kind}-template.xlsx` : "assessment-questions-template.xlsx";
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(await buildImportSample(kind));
});
