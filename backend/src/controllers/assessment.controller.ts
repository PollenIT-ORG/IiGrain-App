import type { Request, Response } from "express";
import * as xlsx from "xlsx";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import {
  addCategory,
  editCategory,
  getCategoryById,
  getCategories,
  orderCategories,
  removeCategory,
  addQuestion,
  editQuestion,
  getQuestionById,
  getQuestions,
  orderQuestions,
  removeQuestion,
  importQuestionsFromRows,
} from "../services/assessment.service.js";

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await getCategories();
  ApiResponse.send(res, 200, "Categories fetched.", { categories });
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await getCategoryById(req.params.id);
  ApiResponse.send(res, 200, "Category fetched.", { category });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await addCategory(req.body);
  ApiResponse.send(res, 201, "Category created.", { category });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await editCategory(req.params.id, req.body);
  ApiResponse.send(res, 200, "Category updated.", { category });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await removeCategory(req.params.id);
  ApiResponse.send(res, 200, "Category deleted.");
});

export const reorderCategoriesCtrl = asyncHandler(async (req: Request, res: Response) => {
  await orderCategories(req.body.items);
  ApiResponse.send(res, 200, "Categories reordered.");
});

export const listQuestions = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as {
    page: number;
    limit: number;
    categoryId?: string;
    isActive?: boolean;
    search?: string;
  };
  const offset = (q.page - 1) * q.limit;

  const result = await getQuestions({
    categoryId: q.categoryId,
    isActive: q.isActive,
    search: q.search,
    limit: q.limit,
    offset,
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

export const getQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await getQuestionById(req.params.id);
  ApiResponse.send(res, 200, "Question fetched.", { question });
});

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await addQuestion(req.body);
  ApiResponse.send(res, 201, "Question created.", { question });
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await editQuestion(req.params.id, req.body);
  ApiResponse.send(res, 200, "Question updated.", { question });
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  await removeQuestion(req.params.id);
  ApiResponse.send(res, 200, "Question deleted.");
});

export const reorderQuestionsCtrl = asyncHandler(async (req: Request, res: Response) => {
  await orderQuestions(req.body.items);
  ApiResponse.send(res, 200, "Questions reordered.");
});

function pick(r: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return "";
}

function looksLikeSpreadsheet(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  const zip = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  const ole =
    buf.length >= 8 &&
    buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 &&
    buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1;
  return zip || ole;
}

export const importExcel = asyncHandler(async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw ApiError.badRequest("No file uploaded. Please attach an Excel file.");

  if (!looksLikeSpreadsheet(file.buffer)) {
    throw ApiError.badRequest(
      "That doesn't look like a valid Excel file. Please upload a .xlsx or .xls file."
    );
  }

  const workbook = xlsx.read(file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw ApiError.badRequest("Excel file has no sheets.");

  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
  });

  const mapped = rows.map((r) => ({
    QuestionCode: pick(r, "QuestionCode", "questionCode", "Question Code"),
    Section: pick(r, "Section", "section", "Category"),
    QuestionText: pick(r, "QuestionText", "questionText", "Question Text", "Question"),
    GuidanceNote: pick(r, "GuidanceNote", "guidanceNote", "Guidance Note", "Guidance"),
    Score0Description: pick(r, "Score0Description", "Score0", "score0_description"),
    Score1Description: pick(r, "Score1Description", "Score1", "score1_description"),
    Score2Description: pick(r, "Score2Description", "Score2", "score2_description"),
    Score3Description: pick(r, "Score3Description", "Score3", "score3_description"),
  }));

  const result = await importQuestionsFromRows(mapped);
  const status = result.created > 0 ? 201 : 200;
  ApiResponse.send(
    res,
    status,
    `Import complete. ${result.created} question(s) created, ${result.skipped} skipped.`,
    result
  );
});
