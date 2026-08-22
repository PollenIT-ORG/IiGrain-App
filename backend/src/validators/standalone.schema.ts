import { z } from "zod";
// "max" metadata validates real number length and prefix per country (the
// default metadata is lenient and accepts, e.g., an over-long Indian number).
import { isValidPhoneNumber } from "libphonenumber-js/max";

// The standalone survey: basic details + 0-3 scale answers. Email is the
// producer's only identity in this flow.

const emailField = z
  .string({ error: "Email address is required." })
  .trim()
  .min(1, "Email address is required.")
  .max(255, "Email address is too long.")
  .email("Enter a valid email address.");

const nameField = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(150, `${label} is too long.`);

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().or(z.literal(""));

// A real, country-aware phone number (E.164, what the app's phone input emits).
// Uses libphonenumber so, e.g., an Indian number that starts with 3 - or any
// wrong-length / wrong-prefix number - is rejected, not just a format check.
// Optional: empty/null pass.
const optionalPhone = z
  .string()
  .trim()
  .refine((v) => isValidPhoneNumber(v), {
    message: "Enter a valid phone number with country code, e.g. +919876543210.",
  })
  .optional()
  .nullable()
  .or(z.literal(""));

// { questionId: 0 | 1 | 2 | 3 }
const answersField = z.record(
  z.string().uuid("Invalid question id."),
  z.number().int().min(0).max(3)
);

const optionalAcres = z.coerce
  .number()
  .positive("Total acres must be greater than zero.")
  .max(1000000, "Enter a realistic acreage.")
  .optional()
  .nullable();

export const emailCheckSchema = z.object({ email: emailField });

export const sendOtpSchema = z.object({ email: emailField });

export const verifyOtpSchema = z.object({
  email: emailField,
  code: z
    .string({ error: "Enter the code." })
    .trim()
    .min(4, "Enter the code.")
    .max(10, "That code is too long."),
});

export const saveDraftSchema = z.object({
  firstName: nameField("First name"),
  lastName: nameField("Last name"),
  email: emailField,
  // Lenient on a draft (may hold a half-typed number); the final submit is
  // where the phone is strictly validated.
  phone: optionalText(20),
  farmName: optionalText(200),
  referralSource: optionalText(200),
  state: optionalText(100),
  totalAcres: optionalAcres,
  answers: answersField.optional(),
});

export const standaloneSubmitSchema = z.object({
  firstName: nameField("First name"),
  lastName: nameField("Last name"),
  email: emailField,
  phone: optionalPhone,
  farmName: optionalText(200),
  referralSource: optionalText(200),
  state: z
    .string({ error: "Please choose your state." })
    .trim()
    .min(1, "Please choose your state.")
    .max(100, "State name is too long."),
  totalAcres: z.coerce
    .number({ error: "Total acres must be a number." })
    .positive("Total acres must be greater than zero.")
    .max(1000000, "Enter a realistic acreage."),
  answers: answersField.refine((v) => Object.keys(v).length > 0, {
    message: "Please answer the survey questions.",
  }),
});

export const statusTokenParamSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32,64}$/i, "This status link is not valid."),
});

export type EmailCheckBody = z.infer<typeof emailCheckSchema>;
export type SaveDraftBody = z.infer<typeof saveDraftSchema>;
export type StandaloneSubmitBody = z.infer<typeof standaloneSubmitSchema>;
export type SendOtpBody = z.infer<typeof sendOtpSchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpSchema>;
