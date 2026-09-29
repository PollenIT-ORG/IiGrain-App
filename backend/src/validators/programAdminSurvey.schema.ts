import { z } from "zod";

// Validation for the Program Admin Survey module. The public survey flow reuses
// the standalone survey body schemas (email/otp/draft/submit); this file holds
// the admin-side schemas plus the URL token params.

const categoryEnum = z.enum(["gold", "silver", "bronze", "not_qualified"]);

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().or(z.literal(""));

const nameField = (label: string, max = 150) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} is too long.`);

const tokenField = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{32,64}$/i, "This link is not valid.");

export const surveyTokenParamSchema = z.object({ token: tokenField });

export const templateIdParamSchema = z.object({
  templateId: z.string().uuid("Invalid template id."),
});

export const scoringRuleParamsSchema = z.object({
  templateId: z.string().uuid("Invalid template id."),
  ruleId: z.string().uuid("Invalid rule id."),
});

// -------------------------------- Templates --------------------------------

export const templateCreateSchema = z.object({
  name: nameField("Template name"),
  description: optionalText(500),
  // "global" copies the shared global template, "blank" starts fresh, or a
  // template uuid to copy from.
  basedOn: z
    .union([
      z.literal("global"),
      z.literal("blank"),
      z.string().uuid("Choose a valid template to copy."),
    ])
    .default("global"),
});

export const templateUpdateSchema = z.object({
  name: nameField("Template name").optional(),
  description: optionalText(500),
  isActive: z.boolean().optional(),
});

// -------------------------------- Categories -------------------------------

export const categorySchema = z.object({
  name: nameField("Category name"),
  description: optionalText(500),
  icon: optionalText(50),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
});

export const categoryUpdateSchema = categorySchema.partial();

// -------------------------------- Questions --------------------------------

export const questionSchema = z.object({
  categoryId: z.string().uuid("Choose a valid category."),
  questionText: nameField("Question", 2000),
  helpText: optionalText(2000),
  weight: z.coerce.number().int().min(1).max(100).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
  options: z.array(z.string().trim().max(200).nullable()).max(4).optional(),
});

export const questionUpdateSchema = questionSchema.partial();

// ------------------------------ Scoring rules ------------------------------

export const scoringRuleSchema = z.object({
  minScore: z.coerce.number().int().min(0).max(100000).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100000).max(100).optional(),
  isActive: z.boolean().optional(),
});

// --------------------------- Programs (surveys) ----------------------------

// Attach a survey to a program from the Programs module.
export const programCreateSchema = z.object({
  programId: z.string().uuid("Choose a program."),
  templateId: z.string().uuid("Choose a survey."),
  contractTemplateId: z
    .string()
    .uuid("Choose a valid contract.")
    .optional()
    .nullable()
    .or(z.literal("")),
  // Set when the caller means to change a program's survey. Without it, a
  // program that already has one is left alone.
  replace: z.boolean().optional(),
});

export const programUpdateSchema = z.object({
  name: nameField("Program name").optional(),
  description: optionalText(500),
  templateId: z.string().uuid("Choose a survey template.").optional(),
  contractTemplateId: z
    .string()
    .uuid("Choose a valid contract.")
    .optional()
    .nullable()
    .or(z.literal("")),
  isActive: z.boolean().optional(),
});

// ---------------------------- Contract templates ---------------------------

export const contractTemplateCreateSchema = z.object({
  name: nameField("Contract name"),
  basedOn: z
    .union([
      z.literal("global"),
      z.literal("blank"),
      z.string().uuid("Choose a valid contract to copy."),
    ])
    .default("global"),
});

export const contractTemplateUpdateSchema = z.object({
  name: nameField("Contract name").optional(),
  intro: optionalText(2000),
  clauses: z
    .array(
      z.object({
        heading: z
          .string()
          .trim()
          .min(1, "Each clause needs a heading.")
          .max(200, "Clause heading is too long."),
        body: z
          .string()
          .trim()
          .min(1, "Each clause needs some text.")
          .max(5000, "Clause text is too long."),
      })
    )
    .max(50, "Too many clauses.")
    .optional(),
  isActive: z.boolean().optional(),
});

export const shareProgramSchema = z.object({
  emails: z
    .array(z.string().trim().email("Enter a valid email address."))
    .min(1, "Add at least one email address.")
    .max(50, "Too many addresses at once."),
});

// ------------------------------- Submissions -------------------------------

export const setCategorySchema = z.object({
  category: categoryEnum,
  reason: optionalText(250),
});

// The cards count the same rows the table lists, so they take the same filters.
// Status is deliberately not one of them: picking a status would empty the five
// cards it does not match.
export const submissionStatsQuerySchema = z.object({
  programId: z.string().uuid("Choose a valid program.").optional(),
  category: categoryEnum.optional(),
  referral: z.string().trim().max(100).optional(),
  createdFrom: z.string().trim().max(40).optional(),
  createdTo: z.string().trim().max(40).optional(),
  search: z.string().trim().max(100).optional(),
});

export const listSubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(20),
  status: z.string().trim().max(40).optional(),
  category: categoryEnum.optional(),
  // The program the submissions came in for, whatever survey they came through.
  programId: z.string().uuid("Choose a valid program.").optional(),
  referral: z.string().trim().max(100).optional(),
  createdFrom: z.string().trim().max(40).optional(),
  createdTo: z.string().trim().max(40).optional(),
  search: z.string().trim().max(100).optional(),
});

export type TemplateCreateBody = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateBody = z.infer<typeof templateUpdateSchema>;
export type CategoryBody = z.infer<typeof categorySchema>;
export type CategoryUpdateBody = z.infer<typeof categoryUpdateSchema>;
export type QuestionBody = z.infer<typeof questionSchema>;
export type QuestionUpdateBody = z.infer<typeof questionUpdateSchema>;
export type ScoringRuleBody = z.infer<typeof scoringRuleSchema>;
export type ProgramCreateBody = z.infer<typeof programCreateSchema>;
export type ProgramUpdateBody = z.infer<typeof programUpdateSchema>;
export type ContractTemplateCreateBody = z.infer<
  typeof contractTemplateCreateSchema
>;
export type ContractTemplateUpdateBody = z.infer<
  typeof contractTemplateUpdateSchema
>;
export type SetCategoryBody = z.infer<typeof setCategorySchema>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type SubmissionStatsQuery = z.infer<typeof submissionStatsQuerySchema>;
