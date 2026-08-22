import { z } from "zod";
import { pageField, limitField } from "./pagination.schema.js";
import { uuidField } from "./common.schema.js";

// Public website: account, survey and contact form.

const emailField = z
  .string({ error: "Email address is required." })
  .trim()
  .min(1, "Email address is required.")
  .max(255, "Email address is too long.")
  .email("Enter a valid email address.");

const passwordField = z
  .string({ error: "Password is required." })
  .min(8, "Use at least 8 characters.")
  .max(128, "Password is too long.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    message: "Include at least one letter and one number.",
  });

const phoneField = z
  .string()
  .trim()
  .max(20, "Phone number is too long.")
  .optional()
  .nullable()
  .or(z.literal(""));

export const webRegisterSchema = z.object({
  fullName: z
    .string({ error: "Your full name is required." })
    .trim()
    .min(2, "Please enter your full name.")
    .max(150, "Name must be 150 characters or fewer."),
  email: emailField,
  password: passwordField,
  phone: phoneField,
});

export const webLoginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: "Password is required." })
    .min(1, "Password is required.")
    .max(200, "That password is too long."),
});

export const submitSurveySchema = z.object({
  state: z
    .string({ error: "Please choose your state." })
    .trim()
    .min(1, "Please choose your state.")
    .max(100, "State name is too long."),
  totalAcres: z.coerce
    .number({ error: "Total acres must be a number." })
    .positive("Total acres must be greater than zero.")
    .max(1000000, "Enter a realistic acreage."),
  // { questionId: 0 | 1 | 2 | 3 }
  answers: z
    .record(z.string().uuid("Invalid question id."), z.number().int().min(0).max(3))
    .refine((v) => Object.keys(v).length > 0, {
      message: "Please answer the survey questions.",
    }),
});

export const signContractSchema = z.object({
  signedName: z
    .string({ error: "Type your full name to sign." })
    .trim()
    .min(2, "Please type your full name.")
    .max(150, "Name is too long."),
  // Data URL of a drawn signature, uploaded server side. Optional when typed.
  signatureImage: z.string().max(2_000_000).optional().nullable(),
  accepted: z.literal(true, {
    error: "You must accept the contract to sign it.",
  }),
});

export const contractTokenParamSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32,64}$/i, "This contract link is not valid."),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const categoryEnum = z.enum(["gold", "silver", "bronze", "not_qualified"], {
  error: "Choose Gold, Silver, Bronze or Not Qualified.",
});

export const listSubmissionsQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(20, 100),
  // Accepts a granular status or a grouped one (under_review, etc.).
  status: z
    .enum([
      "draft",
      "submitted",
      "not_qualified",
      "qualified",
      "contract_sent",
      "contract_signed",
      "enrolled",
      "withdrawn",
      "registered",
      "under_review",
    ])
    .optional(),
  category: categoryEnum.optional(),
  channel: z.enum(["website", "standalone"]).optional(),
  referral: z.string().trim().max(100).optional(),
  createdFrom: z.string().trim().max(40).optional(),
  createdTo: z.string().trim().max(40).optional(),
  search: z.string().trim().max(100).optional(),
});

export const setCategorySchema = z.object({
  category: categoryEnum,
  // Optional admin note explaining the override; stored on the submission.
  reason: z
    .string()
    .trim()
    .max(250, "Reason is too long.")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const surveyQuestionSchema = z.object({
  categoryId: uuidField("category id"),
  questionText: z
    .string({ error: "Question text is required." })
    .trim()
    .min(3, "Question text is required.")
    .max(500, "Question text is too long."),
  helpText: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  // Custom labels for answers 0-3. Blank entries fall back to the defaults.
  options: z.array(z.string().trim().max(120)).max(4).optional(),
  // Multiplier on the 0-3 answer. Weight 1 means the question is worth 0-3.
  weight: z.coerce
    .number({ error: "Weight must be a number." })
    .int("Weight must be a whole number.")
    .min(1, "Weight must be at least 1.")
    .max(20, "Weight is too high.")
    .optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
});

export const updateSurveyQuestionSchema = surveyQuestionSchema
  .partial()
  .refine((o) => Object.keys(o).length > 0, {
    message: "Provide at least one field to update.",
  });

export const surveyCategorySchema = z.object({
  name: z
    .string({ error: "Category name is required." })
    .trim()
    .min(2, "Category name is required.")
    .max(150, "Category name is too long."),
  description: z.string().trim().max(1000).optional().nullable().or(z.literal("")),
  icon: z.string().trim().max(50).optional().nullable().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
});

export const updateSurveyCategorySchema = surveyCategorySchema
  .partial()
  .refine((o) => Object.keys(o).length > 0, {
    message: "Provide at least one field to update.",
  });

export const shareSurveySchema = z.object({
  emails: z
    .array(emailField)
    .min(1, "Add at least one email address.")
    .max(50, "You can share with up to 50 addresses at a time."),
});

export const reorderQuestionsSchema = z.object({
  items: z
    .array(
      z.object({
        id: uuidField("id"),
        sortOrder: z.coerce.number().int().min(0).max(100000),
      })
    )
    .min(1, "Provide at least one item to reorder."),
});

export const updateScoringRuleSchema = z
  .object({
    minScore: z.coerce.number().int().min(0).max(100000).max(10000).optional(),
    maxScore: z.coerce.number().int().min(0).max(100000).max(10000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "Provide at least one field to update.",
  });

export type WebRegisterBody = z.infer<typeof webRegisterSchema>;
export type WebLoginBody = z.infer<typeof webLoginSchema>;
export type SubmitSurveyBody = z.infer<typeof submitSurveySchema>;
export type SignContractBody = z.infer<typeof signContractSchema>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type SurveyQuestionBody = z.infer<typeof surveyQuestionSchema>;
export type UpdateSurveyQuestionBody = z.infer<typeof updateSurveyQuestionSchema>;
export type SurveyCategoryBody = z.infer<typeof surveyCategorySchema>;
export type UpdateSurveyCategoryBody = z.infer<typeof updateSurveyCategorySchema>;
export type ReorderQuestionsBody = z.infer<typeof reorderQuestionsSchema>;
export type ShareSurveyBody = z.infer<typeof shareSurveySchema>;
export type UpdateScoringRuleBody = z.infer<typeof updateScoringRuleSchema>;
