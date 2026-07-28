import type { Request } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as auth from "../services/websiteAuth.service.js";
import * as survey from "../services/survey.service.js";
import * as eligibility from "../services/eligibility.service.js";
import * as contact from "../services/contact.service.js";
import { uploadSignatureDataUrl } from "../services/upload.service.js";
import { websiteUserId } from "../middlewares/websiteAuth.js";
import type {
  WebRegisterBody,
  WebLoginBody,
  SubmitSurveyBody,
  SignContractBody,
  ContactBody,
} from "../validators/web.schema.js";

// Public website endpoints. These serve the marketing site and the eligibility
// survey; they never touch the mobile app's user accounts.

export const register = asyncHandler(async (req, res) => {
  const body = req.body as WebRegisterBody;
  const session = await auth.registerWebsiteUser({
    fullName: body.fullName,
    email: body.email,
    password: body.password,
    phone: body.phone ?? null,
  });
  return ApiResponse.send(res, 201, "Account created.", session);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as WebLoginBody;
  const session = await auth.loginWebsiteUser(email, password);
  return ApiResponse.send(res, 200, "Logged in successfully.", session);
});

export const me = asyncHandler(async (req, res) => {
  const user = await auth.getWebsiteUser(websiteUserId(req));
  return ApiResponse.send(res, 200, "Current user.", { user });
});

export const getQuestions = asyncHandler(async (_req, res) => {
  const questions = await survey.getSurveyQuestions();
  return ApiResponse.send(res, 200, "Survey questions.", { questions });
});

export const submitSurvey = asyncHandler(async (req, res) => {
  const body = req.body as SubmitSurveyBody;
  const result = await eligibility.submitSurvey(websiteUserId(req), {
    state: body.state,
    totalAcres: body.totalAcres,
    answers: body.answers,
  });
  return ApiResponse.send(res, 201, result.message, result);
});

export const myStatus = asyncHandler(async (req, res) => {
  const status = await eligibility.getWebsiteStatus(websiteUserId(req));
  return ApiResponse.send(res, 200, "Your status.", status);
});

export const getContract = asyncHandler(async (req, res) => {
  const data = await eligibility.getContractByToken(req.params.token);
  return ApiResponse.send(res, 200, "Contract.", {
    contract: {
      id: data.contract.id,
      signed: data.contract.signed_at !== null,
      signedName: data.contract.signed_name,
      expiresAt: data.contract.token_expires_at,
    },
    producer: {
      fullName: data.submission.full_name,
      email: data.submission.email,
      state: data.submission.state,
      totalAcres: data.submission.total_acres,
    },
  });
});

function clientIp(req: Request): string | null {
  const fwd = req.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.ip ?? null;
}

export const signContract = asyncHandler(async (req, res) => {
  const body = req.body as SignContractBody;

  // A drawn signature arrives as a data URL; store it as an image.
  let signatureUrl: string | null = null;
  if (body.signatureImage) {
    signatureUrl = await uploadSignatureDataUrl(body.signatureImage);
  }

  const contract = await eligibility.signContractByToken(req.params.token, {
    signedName: body.signedName,
    signatureUrl,
    ip: clientIp(req),
    userAgent: req.get("user-agent") ?? null,
  });

  return ApiResponse.send(res, 200, "Contract signed.", {
    contract: { id: contract.id, signedAt: contract.signed_at },
  });
});

export const submitContact = asyncHandler(async (req, res) => {
  const body = req.body as ContactBody;
  await contact.submitEnquiry({
    name: body.name,
    email: body.email,
    phone: body.phone ?? null,
    subject: body.subject ?? null,
    message: body.message,
  });
  return ApiResponse.send(
    res,
    201,
    "Thanks for getting in touch. Our team will reply shortly."
  );
});
