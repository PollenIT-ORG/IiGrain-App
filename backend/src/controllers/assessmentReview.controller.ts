import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as reviews from "../services/assessmentReview.service.js";
import type { ReviewScoresBody } from "../validators/assessment.schema.js";

function actorOf(req: Request): reviews.ReviewActor {
  const id = req.user?.sub;
  if (!id) throw ApiError.unauthorized("Authentication required.");
  return { id, role: req.user!.role };
}

export const getReview = asyncHandler(async (req: Request, res: Response) => {
  const detail = await reviews.getReviewDetail(req.params.id, actorOf(req));
  ApiResponse.send(res, 200, "Assessment fetched.", detail);
});

export const saveReviewScores = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviews.saveReview(
    req.params.id,
    actorOf(req),
    req.body as ReviewScoresBody
  );
  ApiResponse.send(res, 200, "Scores saved.", { review });
});

export const approveReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviews.approveReview(
    req.params.id,
    actorOf(req),
    req.body as ReviewScoresBody
  );
  ApiResponse.send(res, 200, "Assessment approved.", { review });
});
