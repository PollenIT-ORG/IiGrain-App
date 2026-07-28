import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import {
  getMyFieldsAssessmentList,
  getMyCompletedAssessments,
  getFieldAssessmentSummary,
  getFieldRegenIndex,
  getFieldCategoryQuestions,
  getFieldCategoryQuestionList,
  getFieldQuestionDetail,
  saveFieldAnswer,
  getFieldReview,
  getFieldAssessmentHistory,
  submitFieldAssessmentForUser,
  discardFieldAssessmentForUser,
} from "../services/assessmentMobile.service.js";
import { uploadEvidenceImages } from "../services/upload.service.js";
import type { PaginationQuery } from "../validators/pagination.schema.js";
import type { HistoryQuery } from "../validators/assessment.schema.js";

export const uploadEvidence = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const files =
      (req as Request & { files?: Express.Multer.File[] }).files ?? [];
    const urls = await uploadEvidenceImages(files);

    ApiResponse.send(res, 201, "Evidence uploaded.", { urls });
  }
);

export const myFieldsAssessmentList = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const year = new Date().getFullYear();
    const q = req.query as unknown as PaginationQuery;
    const { result, meta } = await getMyFieldsAssessmentList({
      userId,
      year,
      page: q.page,
      limit: q.limit,
      search: q.search,
    });
    ApiResponse.send(res, 200, "My assessments fetched.", result, meta);
  }
);

export const myAssessmentHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const q = req.query as unknown as HistoryQuery;
    const { result, meta } = await getMyCompletedAssessments({
      userId,
      farmId: q.farmId ?? null,
      page: q.page,
      limit: q.limit,
      search: q.search,
    });
    ApiResponse.send(res, 200, "Assessment history fetched.", result, meta);
  }
);

export const myFieldAssessmentSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const year = new Date().getFullYear();
    const summary = await getFieldAssessmentSummary(
      req.params.fieldId,
      req.params.programId,
      userId,
      year
    );
    ApiResponse.send(res, 200, "Assessment summary fetched.", summary);
  }
);

export const myFieldRegenIndex = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const result = await getFieldRegenIndex(
      req.params.fieldId,
      req.params.programId,
      userId
    );
    ApiResponse.send(res, 200, "Field regen health index fetched.", result);
  }
);

export const myFieldCategoryQuestions = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const result = await getFieldCategoryQuestions(
      req.params.fieldId,
      req.params.programId,
      req.params.categoryId,
      userId
    );
    ApiResponse.send(res, 200, "Category questions fetched.", result);
  }
);

export const myFieldCategoryQuestionList = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const result = await getFieldCategoryQuestionList(
      req.params.fieldId,
      req.params.programId,
      req.params.categoryId,
      userId
    );
    ApiResponse.send(res, 200, "Category question list fetched.", result);
  }
);

export const myFieldQuestionDetail = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const result = await getFieldQuestionDetail(
      req.params.fieldId,
      req.params.programId,
      req.params.categoryId,
      req.params.questionId,
      userId
    );
    ApiResponse.send(res, 200, "Question fetched.", result);
  }
);

export const saveMyFieldAnswer = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const response = await saveFieldAnswer(
      req.params.fieldId,
      req.params.programId,
      req.params.questionId,
      userId,
      req.body
    );
    ApiResponse.send(res, 200, "Answer saved.", { response });
  }
);

export const myFieldReview = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const review = await getFieldReview(
      req.params.fieldId,
      req.params.programId,
      userId
    );
    ApiResponse.send(res, 200, "Assessment review fetched.", review);
  }
);

export const myFieldAssessmentHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const history = await getFieldAssessmentHistory(
      req.params.fieldId,
      req.params.programId,
      userId
    );
    ApiResponse.send(res, 200, "Assessment history fetched.", history);
  }
);

export const submitMyFieldAssessment = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const result = await submitFieldAssessmentForUser(
      req.params.fieldId,
      req.params.programId,
      userId
    );
    ApiResponse.send(res, 200, "Assessment submitted successfully.", result);
  }
);

export const discardMyFieldAssessment = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) throw ApiError.unauthorized("Authentication required.");

    const result = await discardFieldAssessmentForUser(
      req.params.fieldId,
      req.params.programId,
      userId
    );
    ApiResponse.send(res, 200, "Assessment discarded.", result);
  }
);
