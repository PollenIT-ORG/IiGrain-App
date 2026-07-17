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
  .min(1, "Refresh token is required.");

export const registerSchema = z.object({
  fullName: nameField,
  email: emailField,
  phone: phoneField,
  password: passwordField,
  role: z.string().trim().min(1).optional(),
});

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: "Password is required." })
    .min(1, "Password is required."),
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

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type RequestOtpBody = z.infer<typeof requestOtpSchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenBody = z.infer<typeof refreshTokenSchema>;
export type LogoutBody = z.infer<typeof logoutSchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
