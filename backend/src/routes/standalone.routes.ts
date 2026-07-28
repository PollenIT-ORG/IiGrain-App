import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { surveySubmitLimiter } from "../middlewares/rateLimiters.js";
import {
  standaloneSubmitSchema,
  saveDraftSchema,
  emailCheckSchema,
  statusTokenParamSchema,
} from "../validators/standalone.schema.js";
import {
  signContractSchema,
  contractTokenParamSchema,
} from "../validators/web.schema.js";
import {
  structure,
  checkEmail,
  saveDraft,
  submit,
  status,
  statusLookup,
} from "../controllers/standalone.controller.js";
import { getContract, signContract } from "../controllers/web.controller.js";

// The standalone survey flow. Everything here is public and token-based - there
// is no account and no password. Reuses the contract get/sign endpoints, which
// are keyed by token and channel-agnostic.
const router = Router();

router.get("/structure", structure);

router.post("/check-email", validate(emailCheckSchema), checkEmail);
router.post("/save-draft", validate(saveDraftSchema), saveDraft);
router.post("/submit", surveySubmitLimiter, validate(standaloneSubmitSchema), submit);

router.get("/status/:token", validate(statusTokenParamSchema, "params"), status);
router.post("/status-lookup", surveySubmitLimiter, validate(emailCheckSchema), statusLookup);

router.get(
  "/contract/:token",
  validate(contractTokenParamSchema, "params"),
  getContract
);
router.post(
  "/contract/:token/sign",
  validate(contractTokenParamSchema, "params"),
  validate(signContractSchema),
  signContract
);

export default router;
