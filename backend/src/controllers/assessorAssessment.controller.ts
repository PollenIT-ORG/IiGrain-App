import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as service from "../services/assessorAssessment.service.js";

function assessorId(req: Request): string {
  const id = req.user?.sub;
  if (!id) throw ApiError.unauthorized("Authentication required.");
  return id;
}

export const myAssessorFields = asyncHandler(async (req: Request, res: Response) => {
  const year = new Date().getFullYear();
  const result = await service.getAssessorFieldList(assessorId(req), year);
  return ApiResponse.send(res, 200, "Assessor fields fetched.", result);
});

export const assessorSummary = asyncHandler(async (req: Request, res: Response) => {
  const year = new Date().getFullYear();
  const result = await service.getAssessorSummary(req.params.fieldId, assessorId(req), year);
  return ApiResponse.send(res, 200, "Assessment summary fetched.", result);
});

export const assessorCategoryQuestionList = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.getAssessorCategoryQuestionList(
      req.params.fieldId,
      req.params.categoryId,
      assessorId(req)
    );
    return ApiResponse.send(res, 200, "Category question list fetched.", result);
  }
);

export const assessorQuestionDetail = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.getAssessorQuestionDetail(
      req.params.fieldId,
      req.params.categoryId,
      req.params.questionId,
      assessorId(req)
    );
    return ApiResponse.send(res, 200, "Question fetched.", result);
  }
);

export const assessorCategoryQuestions = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.getAssessorCategoryQuestions(
      req.params.fieldId,
      req.params.categoryId,
      assessorId(req)
    );
    return ApiResponse.send(res, 200, "Category questions fetched.", result);
  }
);

export const saveAssessorAnswer = asyncHandler(async (req: Request, res: Response) => {
  const response = await service.saveAssessorAnswer(
    req.params.fieldId,
    req.params.questionId,
    assessorId(req),
    req.body
  );
  return ApiResponse.send(res, 200, "Answer saved.", { response });
});

export const assessorReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await service.getAssessorReview(req.params.fieldId, assessorId(req));
  return ApiResponse.send(res, 200, "Assessment review fetched.", review);
});

export const submitAssessorAssessment = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.submitAssessorAssessment(
      req.params.fieldId,
      assessorId(req)
    );
    return ApiResponse.send(res, 200, "Assessment submitted successfully.", result);
  }
);

export const farmerAssessment = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getFarmerAssessmentForAssessor(
    req.params.fieldId,
    assessorId(req)
  );
  return ApiResponse.send(res, 200, "Farmer assessment fetched.", result);
});

export const comparison = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getComparison(req.params.fieldId, assessorId(req));
  return ApiResponse.send(res, 200, "Comparison fetched.", result);
});
