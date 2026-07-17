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
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { forgotPasswordLimiter } from "../middlewares/rateLimiters.js";
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
} from "../validators/auth.schema.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);

router.post("/request-otp", validate(requestOtpSchema), requestOtp);
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp);

router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);
router.post("/logout", validate(logoutSchema), logout);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

router.get("/me", authenticate, me);

export default router;
