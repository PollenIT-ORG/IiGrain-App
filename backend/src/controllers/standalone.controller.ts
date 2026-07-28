import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as standalone from "../services/standalone.service.js";
import * as survey from "../services/survey.service.js";
import type {
  StandaloneSubmitBody,
  SaveDraftBody,
  EmailCheckBody,
} from "../validators/standalone.schema.js";

// The standalone survey flow. No account, no password: the producer is tracked
// by email, saves drafts, and resumes.

export const structure = asyncHandler(async (_req, res) => {
  const categories = await survey.getSurveyStructure();
  return ApiResponse.send(res, 200, "Survey structure.", {
    categories,
    scaleLabels: survey.SCALE_LABELS,
  });
});

export const checkEmail = asyncHandler(async (req, res) => {
  const { email } = req.body as EmailCheckBody;
  const result = await standalone.checkEmail(email);
  return ApiResponse.send(res, 200, "Email checked.", result);
});

export const saveDraft = asyncHandler(async (req, res) => {
  const body = req.body as SaveDraftBody;
  const result = await standalone.saveDraft({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone ?? null,
    farmName: body.farmName ?? null,
    referralSource: body.referralSource ?? null,
    state: body.state ?? null,
    totalAcres: body.totalAcres ?? null,
    answers: body.answers ?? {},
  });
  return ApiResponse.send(res, 200, "Progress saved.", result);
});

export const submit = asyncHandler(async (req, res) => {
  const body = req.body as StandaloneSubmitBody;
  const result = await standalone.submitStandalone({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone ?? null,
    farmName: body.farmName ?? null,
    referralSource: body.referralSource ?? null,
    state: body.state ?? null,
    totalAcres: body.totalAcres ?? null,
    answers: body.answers,
  });
  return ApiResponse.send(res, 201, result.message, {
    statusToken: result.statusToken,
    qualified: result.qualified,
    message: result.message,
    category: result.category,
  });
});

export const status = asyncHandler(async (req, res) => {
  const data = await standalone.getStandaloneStatus(req.params.token);
  return ApiResponse.send(res, 200, "Your status.", data);
});

export const statusLookup = asyncHandler(async (req, res) => {
  const { email } = req.body as EmailCheckBody;
  const statusToken = await standalone.statusTokenForEmail(email);
  return ApiResponse.send(res, 200, "Status found.", { statusToken });
});
