import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import {
  surveySubmitLimiter,
  requestCodeLimiter,
  codeAttemptLimiter,
} from "../middlewares/rateLimiters.js";
import {
  emailCheckSchema,
  sendOtpSchema,
  verifyOtpSchema,
  saveDraftSchema,
  standaloneSubmitSchema,
  statusTokenParamSchema,
} from "../validators/standalone.schema.js";
import {
  signContractSchema,
  contractTokenParamSchema,
} from "../validators/contract.schema.js";
import { surveyTokenParamSchema } from "../validators/programAdminSurvey.schema.js";
import {
  structure,
  checkEmail,
  sendOtp,
  verifyOtp,
  saveDraft,
  submit,
  status,
  getContract,
  getContractPdf,
  signContract,
} from "../controllers/programAdminSurveyPublic.controller.js";

// Public survey flow for a program's shareable link. Everything is token-based;
// there is no account and no password.
const router = Router();
const withToken = validate(surveyTokenParamSchema, "params");

// Email verification is not tied to a program, so it needs no survey token.
router.post("/send-otp", requestCodeLimiter, validate(sendOtpSchema), sendOtp);
router.post("/verify-otp", codeAttemptLimiter, validate(verifyOtpSchema), verifyOtp);

// The producer's status page (by their own magic-link token).
router.get(
  "/status/:token",
  validate(statusTokenParamSchema, "params"),
  status
);

// Contract read + sign (token-based, channel-agnostic).
router.get(
  "/contract/:token",
  validate(contractTokenParamSchema, "params"),
  getContract
);
router.get(
  "/contract/:token/pdf",
  validate(contractTokenParamSchema, "params"),
  getContractPdf
);
router.post(
  "/contract/:token/sign",
  validate(contractTokenParamSchema, "params"),
  validate(signContractSchema),
  signContract
);

// Everything below is scoped to a program by its survey token.
router.get("/:token/structure", withToken, structure);
router.post("/:token/check-email", withToken, validate(emailCheckSchema), checkEmail);
router.post("/:token/save-draft", withToken, validate(saveDraftSchema), saveDraft);
router.post(
  "/:token/submit",
  surveySubmitLimiter,
  withToken,
  validate(standaloneSubmitSchema),
  submit
);

export default router;
