import type { Request } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import * as authService from "../services/auth.service.js";
import * as userService from "../services/user.service.js";
import type {
  RegisterBody,
  LoginBody,
  RequestOtpBody,
  VerifyOtpBody,
  RefreshTokenBody,
  LogoutBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  CheckEmailQuery,
} from "../validators/auth.schema.js";

function reqContext(req: Request): { ip: string | null; userAgent: string | null } {
  return {
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

// The OTP is echoed in the API response only while SMTP is off (local/dev), so
// devs can test without email. Once real emails are being sent, the code never
// travels over the API - it goes only to the user's inbox.
function otpEcho(code: string | undefined): { code?: string } {
  return env.smtp.enabled || !code ? {} : { code };
}

export const checkEmail = asyncHandler(async (req, res) => {
  const { email } = req.query as unknown as CheckEmailQuery;
  const result = await authService.checkEmailAvailability(email);
  return ApiResponse.send(
    res,
    200,
    result.available
      ? "This email is available."
      : "An account with this email already exists.",
    result
  );
});

export const register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, enrollmentId } =
    req.body as RegisterBody;

  const { code, ...result } = await authService.register({
    email,
    password,
    fullName,
    phone,
    enrollmentId,
  });

  return ApiResponse.send(
    res,
    201,
    "Account created. We've sent a verification code - verify it to activate your account.",
    { ...result, ...otpEcho(code) }
  );
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as LoginBody;

  const result = await authService.loginWithPassword(
    email,
    password,
    reqContext(req)
  );

  return ApiResponse.send(res, 200, "Logged in successfully.", result);
});

export const requestOtp = asyncHandler(async (req, res) => {
  const { email } = req.body as RequestOtpBody;

  const code = await authService.requestOtp(email);

  return ApiResponse.send(
    res,
    200,
    "A verification code has been sent.",
    otpEcho(code)
  );
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, code } = req.body as VerifyOtpBody;

  const result = await authService.verifyOtp(email, code, reqContext(req));

  return ApiResponse.send(res, 200, "Logged in successfully.", result);
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body as RefreshTokenBody;

  const result = await authService.refreshAccessToken(token);

  return ApiResponse.send(res, 200, "Token refreshed.", result);
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body as LogoutBody;

  await authService.logout(token);

  return ApiResponse.send(res, 200, "Logged out successfully.");
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body as ForgotPasswordBody;

  const code = await authService.forgotPassword(email);

  return ApiResponse.send(
    res,
    200,
    "A password reset code has been sent.",
    otpEcho(code)
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body as ResetPasswordBody;

  await authService.resetPassword(email, code, newPassword);

  return ApiResponse.send(
    res,
    200,
    "Password reset successful. You can now sign in with your new password."
  );
});

export const verifyResetCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body as VerifyOtpBody;

  await authService.verifyResetCode(email, code);

  return ApiResponse.send(res, 200, "Code verified. You can set a new password.");
});

export const me = asyncHandler(async (req, res) => {
  // req.user is the decoded JWT ({ sub, email, role }), not a user row. Returning
  // it directly gave clients a user with no id, no name and no avatar. Load the
  // real record so this matches the shape of every other user-returning endpoint.
  if (!req.user) throw ApiError.unauthorized("Authentication required.");
  const user = await userService.getUserById(req.user.sub);
  return ApiResponse.send(res, 200, "Current user.", { user });
});
