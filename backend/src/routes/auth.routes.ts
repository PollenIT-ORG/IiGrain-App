import { Router } from "express";
import {
  register,
  enrollmentIdLookup,
  login,
  requestOtp,
  verifyOtp,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyResetCode,
  me,
  checkEmail,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import {
  forgotPasswordLimiter,
  emailCheckLimiter,
  loginLimiter,
  enrollmentLookupLimiter,
  codeAttemptLimiter,
  requestCodeLimiter,
} from "../middlewares/rateLimiters.js";
import { validate } from "../middlewares/validate.js";
import {
  registerSchema,
  enrollmentLookupSchema,
  loginSchema,
  requestOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  checkEmailQuerySchema,
} from "../validators/auth.schema.js";

const router = Router();

router.get(
  "/check-email",
  emailCheckLimiter,
  validate(checkEmailQuerySchema, "query"),
  checkEmail
);
// Prefills the sign-up form from the Enrollment ID. Masked on purpose: the ID
// space is guessable, so a real address is never handed back.
router.post(
  "/enrollment-id/lookup",
  enrollmentLookupLimiter,
  validate(enrollmentLookupSchema),
  enrollmentIdLookup
);

router.post(
  "/register",
  requestCodeLimiter,
  validate(registerSchema),
  register
);
router.post("/login", loginLimiter, validate(loginSchema), login);

router.post(
  "/request-otp",
  requestCodeLimiter,
  validate(requestOtpSchema),
  requestOtp
);
router.post(
  "/verify-otp",
  codeAttemptLimiter,
  validate(verifyOtpSchema),
  verifyOtp
);

router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);
router.post("/logout", validate(logoutSchema), logout);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);
// Validates the reset code without consuming it, so the app can gate the
// new-password screen behind a correct code.
router.post(
  "/verify-reset-code",
  codeAttemptLimiter,
  validate(verifyOtpSchema),
  verifyResetCode
);
router.post(
  "/reset-password",
  codeAttemptLimiter,
  validate(resetPasswordSchema),
  resetPassword
);

router.get("/me", authenticate, me);

export default router;
