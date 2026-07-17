import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid id."),
});

export const fieldIdParamSchema = z.object({
  fieldId: z.string().uuid("Invalid field id."),
});

export const historyQuerySchema = z.object({
  farmId: z.string().uuid("Invalid farm id.").optional(),
});

export const fieldCategoryParamsSchema = z.object({
  fieldId: z.string().uuid("Invalid field id."),
  categoryId: z.string().uuid("Invalid category id."),
});

export const fieldQuestionParamsSchema = z.object({
  fieldId: z.string().uuid("Invalid field id."),
  questionId: z.string().uuid("Invalid question id."),
});

export const fieldCategoryQuestionParamsSchema = z.object({
  fieldId: z.string().uuid("Invalid field id."),
  categoryId: z.string().uuid("Invalid category id."),
  questionId: z.string().uuid("Invalid question id."),
});

const cloudinaryUrl = z
  .string()
  .trim()
  .url("Each evidence item must be a valid URL.")
  .refine(
    (u) => /^https:\/\/res\.cloudinary\.com\//i.test(u),
    "Evidence must be a Cloudinary image URL."
  );

export const saveAnswerSchema = z.object({
  score: z.coerce
    .number({ error: "A score is required." })
    .int("Score must be a whole number.")
    .min(0, "Score must be between 0 and 3.")
    .max(3, "Score must be between 0 and 3."),
  comment: z.string().trim().max(2000, "Comment is too long.").optional().or(z.literal("")),
  evidenceUrls: z
    .array(cloudinaryUrl)
    .max(5, "You can attach at most 5 photos.")
    .optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    description: z.string().max(500).optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    error: "Provide at least one field to update.",
  });

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.coerce.number().int().min(0),
      })
    )
    .min(1),
});

export const createQuestionSchema = z.object({
  categoryId: z.string().uuid(),
  questionCode: z.string().max(20).optional().nullable(),
  questionText: z.string().min(1),
  guidanceNote: z.string().optional().nullable(),
  score0Description: z.string().optional().nullable(),
  score1Description: z.string().optional().nullable(),
  score2Description: z.string().optional().nullable(),
  score3Description: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateQuestionSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    questionCode: z.string().max(20).optional().nullable(),
    questionText: z.string().min(1).optional(),
    guidanceNote: z.string().optional().nullable(),
    score0Description: z.string().optional().nullable(),
    score1Description: z.string().optional().nullable(),
    score2Description: z.string().optional().nullable(),
    score3Description: z.string().optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    error: "Provide at least one field to update.",
  });

export const listQuestionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  categoryId: z.string().uuid().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => {
      if (v === "true") return true;
      if (v === "false") return false;
      return undefined;
    }),
  search: z.string().optional(),
});
