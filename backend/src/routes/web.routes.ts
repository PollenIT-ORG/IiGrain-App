import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { authenticateWebsite } from "../middlewares/websiteAuth.js";
import { loginLimiter } from "../middlewares/rateLimiters.js";
import {
  webRegisterSchema,
  webLoginSchema,
  submitSurveySchema,
  signContractSchema,
  contractTokenParamSchema,
} from "../validators/web.schema.js";
import {
  register,
  login,
  me,
  getQuestions,
  submitSurvey,
  myStatus,
  getContract,
  signContract,
} from "../controllers/web.controller.js";

// Public website. Separate from the mobile app's /auth routes on purpose: these
// accounts live in website_users and can never sign in to the app.
const router = Router();

router.post("/auth/register", loginLimiter, validate(webRegisterSchema), register);
router.post("/auth/login", loginLimiter, validate(webLoginSchema), login);
router.get("/auth/me", authenticateWebsite, me);

router.get("/survey/questions", getQuestions);
router.post(
  "/survey/submit",
  authenticateWebsite,
  validate(submitSurveySchema),
  submitSurvey
);
router.get("/me/status", authenticateWebsite, myStatus);

// The signing link is authenticated by its token, so it works straight from the
// email without logging in.
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
