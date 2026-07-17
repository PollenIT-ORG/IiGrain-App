import type { Request } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as authService from "../services/auth.service.js";
import type {
  RegisterBody,
  LoginBody,
  RequestOtpBody,
  VerifyOtpBody,
  RefreshTokenBody,
  LogoutBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "../validators/auth.schema.js";

function reqContext(req: Request): { ip: string | null; userAgent: string | null } {
  return {
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

export const register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, role } = req.body as RegisterBody;

  const result = await authService.register({
    email,
    password,
    fullName,
    phone,
    role,
  });

  return ApiResponse.send(
    res,
    201,
    "Account created. We've sent a verification code - verify it to activate your account.",
    result
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

  return ApiResponse.send(res, 200, "A verification code has been sent.", {
    code,
  });
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

  return ApiResponse.send(res, 200, "A password reset code has been sent.", {
    code,
  });
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

export const me = asyncHandler(async (req, res) => {
  return ApiResponse.send(res, 200, "Current user.", { user: req.user });
});
