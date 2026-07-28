import { Router } from "express";
import {
  register,
  login,
  requestOtp,
  verifyOtp,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  me,
  checkEmail,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import {
  forgotPasswordLimiter,
  emailCheckLimiter,
  loginLimiter,
  codeAttemptLimiter,
  requestCodeLimiter,
} from "../middlewares/rateLimiters.js";
import { validate } from "../middlewares/validate.js";
import {
  registerSchema,
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
router.post(
  "/reset-password",
  codeAttemptLimiter,
  validate(resetPasswordSchema),
  resetPassword
);

router.get("/me", authenticate, me);

export default router;
