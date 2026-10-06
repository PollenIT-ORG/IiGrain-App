import type { Request } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  fetchStoredPdf,
  buildContractPdf,
} from "../services/contractPdf.service.js";
import * as svc from "../services/programAdminSurvey.service.js";
import { uploadSignatureDataUrl } from "../services/upload.service.js";
import type {
  StandaloneSubmitBody,
  SaveDraftBody,
  EmailCheckBody,
  SendOtpBody,
  VerifyOtpBody,
} from "../validators/standalone.schema.js";
import type { SignContractBody } from "../validators/contract.schema.js";

// The public survey flow for a program's shareable link. No account, no
// password: the producer is tracked by email against one program's survey.

export const structure = asyncHandler(async (req, res) => {
  const data = await svc.getPublicSurveyStructure(req.params.token);
  return ApiResponse.send(res, 200, "Survey.", data);
});

export const checkEmail = asyncHandler(async (req, res) => {
  const { email } = req.body as EmailCheckBody;
  const result = await svc.checkEmail(req.params.token, email);
  return ApiResponse.send(res, 200, "Email checked.", result);
});

export const sendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body as SendOtpBody;
  const result = await svc.sendSurveyOtp(email);
  return ApiResponse.send(res, 200, "Verification code sent.", result);
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, code } = req.body as VerifyOtpBody;
  await svc.verifySurveyOtp(email, code);
  return ApiResponse.send(res, 200, "Email verified.", { verified: true });
});

export const saveDraft = asyncHandler(async (req, res) => {
  const body = req.body as SaveDraftBody;
  const result = await svc.saveDraft(req.params.token, {
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
  const result = await svc.submitSurvey(req.params.token, {
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
  const data = await svc.getStatus(req.params.token);
  return ApiResponse.send(res, 200, "Your status.", data);
});

export const getContract = asyncHandler(async (req, res) => {
  const data = await svc.getContractByToken(req.params.token);
  return ApiResponse.send(res, 200, "Contract.", {
    contract: {
      id: data.contract.id,
      signed: data.contract.signed_at !== null,
      signedName: data.contract.signed_name,
      expiresAt: data.contract.token_expires_at,
    },
    body: data.body,
    producer: {
      fullName: data.submission.full_name,
      email: data.submission.email,
      programName: data.submission.survey_name,
      state: data.submission.state,
      totalAcres: data.submission.total_acres,
    },
  });
});

/**
 * The contract PDF for a signing link, served from our own domain so the
 * browser gets a real application/pdf response and can display it inline.
 */
export const getContractPdf = asyncHandler(async (req, res) => {
  const data = await svc.getContractByToken(req.params.token);
  // An uploaded contract is served as it is; a written one is laid out as the
  // same document, so the producer always reads a proper contract.
  const survey = await svc.getSurveyForSubmission(data.submission.survey_id);
  const pdf = data.body.pdfUrl
    ? await fetchStoredPdf(data.body.pdfUrl)
    : Buffer.from(
        await buildContractPdf(
          await svc.contractDocFor(
            survey?.program_id ?? null,
            data.body,
            data.contract.created_at
          )
        )
      );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", pdf.length);
  res.setHeader("Content-Disposition", 'inline; filename="contract.pdf"');
  res.end(pdf);
});

function clientIp(req: Request): string | null {
  const fwd = req.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.ip ?? null;
}

export const signContract = asyncHandler(async (req, res) => {
  const body = req.body as SignContractBody;
  let signatureUrl: string | null = null;
  if (body.signatureImage) {
    signatureUrl = await uploadSignatureDataUrl(body.signatureImage);
  }
  const contract = await svc.signContractByToken(req.params.token, {
    signedName: body.signedName,
    signatureUrl,
    ip: clientIp(req),
    userAgent: req.get("user-agent") ?? null,
  });
  return ApiResponse.send(res, 200, "Contract signed.", {
    contract: { id: contract.id, signedAt: contract.signed_at },
  });
});
