import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as service from "../services/assessorAssessment.service.js";
import type { SaveCategoryAnswersBody } from "../validators/assessment.schema.js";

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
  const result = await service.getAssessorSummary(
    req.params.fieldId,
    req.params.programId,
    assessorId(req),
    year
  );
  return ApiResponse.send(res, 200, "Assessment summary fetched.", result);
});

export const assessorCategoryQuestionList = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.getAssessorCategoryQuestionList(
      req.params.fieldId,
      req.params.programId,
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
      req.params.programId,
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
      req.params.programId,
      req.params.categoryId,
      assessorId(req)
    );
    return ApiResponse.send(res, 200, "Category questions fetched.", result);
  }
);

// One form, one save: every field of a category at once.
export const saveAssessorCategoryAnswers = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.saveAssessorCategoryAnswers(
    req.params.fieldId,
    req.params.programId,
    req.params.categoryId,
    assessorId(req),
    req.body as SaveCategoryAnswersBody
  );
  return ApiResponse.send(res, 200, "Form saved.", result);
});

// One more filling of an input based form.
export const addAssessorRecord = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.addAssessorRecord(
    req.params.fieldId,
    req.params.programId,
    req.params.categoryId,
    assessorId(req),
    req.body as SaveCategoryAnswersBody
  );
  return ApiResponse.send(res, 201, "Record added.", result);
});

export const saveAssessorRecord = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.saveAssessorRecord(
    req.params.fieldId,
    req.params.programId,
    req.params.categoryId,
    req.params.recordId,
    assessorId(req),
    req.body as SaveCategoryAnswersBody
  );
  return ApiResponse.send(res, 200, "Record saved.", result);
});

export const removeAssessorRecord = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.removeAssessorRecord(
    req.params.fieldId,
    req.params.programId,
    req.params.categoryId,
    req.params.recordId,
    assessorId(req)
  );
  return ApiResponse.send(res, 200, "Record removed.", result);
});

export const saveAssessorAnswer = asyncHandler(async (req: Request, res: Response) => {
  const response = await service.saveAssessorAnswer(
    req.params.fieldId,
    req.params.programId,
    req.params.questionId,
    assessorId(req),
    req.body
  );
  return ApiResponse.send(res, 200, "Answer saved.", { response });
});

export const assessorReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await service.getAssessorReview(
    req.params.fieldId,
    req.params.programId,
    assessorId(req)
  );
  return ApiResponse.send(res, 200, "Assessment review fetched.", review);
});

export const submitAssessorAssessment = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.submitAssessorAssessment(
      req.params.fieldId,
      req.params.programId,
      assessorId(req)
    );
    return ApiResponse.send(res, 200, "Assessment submitted successfully.", result);
  }
);

export const farmerAssessment = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getFarmerAssessmentForAssessor(
    req.params.fieldId,
    req.params.programId,
    assessorId(req)
  );
  return ApiResponse.send(res, 200, "Farmer assessment fetched.", result);
});

export const comparison = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getComparison(
    req.params.fieldId,
    req.params.programId,
    assessorId(req)
  );
  return ApiResponse.send(res, 200, "Comparison fetched.", result);
});
