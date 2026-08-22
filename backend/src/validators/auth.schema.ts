import { z } from "zod";
import env from "../config/env.js";

const otpLen = env.otp.length;

export const nameField = z
  .string({ error: "Full name is required." })
  .trim()
  .min(2, "Full name must be at least 2 characters.")
  .max(100, "Full name must be at most 100 characters.");

export const emailField = z
  .string({ error: "Email is required." })
  .trim()
  .min(1, "Email is required.")
  .max(255, "Email must be at most 255 characters.")
  .email("Enter a valid email address.")
  .toLowerCase();

export const passwordField = z
  .string({ error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  .max(64, "Password must be at most 64 characters.")
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
    message: "Password must include at least one letter and one number.",
  });

export const phoneField = z
  .union([z.string(), z.number()], {
    error: "Mobile number is required.",
  })
  .transform((v) => {
    const str = String(v).trim();
    const hadPlus = str.startsWith("+");
    const digits = str.replace(/\D/g, "");
    return { hadPlus, digits };
  })
  .refine((p) => p.hadPlus && p.digits.length >= 8 && p.digits.length <= 15, {
    message:
      "Enter a valid mobile number with country code, e.g. +919876543210.",
  })
  .transform((p) => `+${p.digits}`);

export const otpField = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => new RegExp(`^\\d{${otpLen}}$`).test(v), {
    message: `Code must be exactly ${otpLen} digits.`,
  });

const refreshTokenField = z
  .string({ error: "Refresh token is required." })
  .trim()
  .min(1, "Refresh token is required.")
  .max(255, "That token is not valid.");

// Self-registration always creates a farmer. `role` is deliberately NOT accepted
// here: privileged roles may only be created through the authenticated admin
// path, which enforces canCreateRole. Any role sent by a client is stripped.
// The ID from the acceptance email, e.g. IIG-2026-123456. Case and spacing are
// forgiven because people copy it out of an email by hand.
export const enrollmentIdField = z
  .string({ error: "Enrollment ID is required." })
  .trim()
  .min(1, "Enrollment ID is required.")
  .max(32, "That Enrollment ID is too long.")
  .transform((v) => v.replace(/\s+/g, "").toUpperCase());

export const registerSchema = z.object({
  fullName: nameField,
  email: emailField,
  phone: phoneField,
  password: passwordField,
  enrollmentId: enrollmentIdField,
});

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: "Password is required." })
    .min(1, "Password is required.")
    .max(200, "That password is too long."),
});

export const requestOtpSchema = z.object({
  email: emailField,
});

export const verifyOtpSchema = z.object({
  email: emailField,
  code: otpField,
});

export const refreshTokenSchema = z.object({
  refreshToken: refreshTokenField,
});

export const logoutSchema = z.object({
  refreshToken: refreshTokenField,
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  email: emailField,
  code: otpField,
  newPassword: passwordField,
});

export const checkEmailQuerySchema = z.object({
  email: emailField,
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type RequestOtpBody = z.infer<typeof requestOtpSchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenBody = z.infer<typeof refreshTokenSchema>;
export type LogoutBody = z.infer<typeof logoutSchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type CheckEmailQuery = z.infer<typeof checkEmailQuerySchema>;
