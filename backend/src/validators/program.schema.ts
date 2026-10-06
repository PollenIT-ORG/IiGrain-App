import { z } from "zod";
import { pageField, limitField } from "./pagination.schema.js";
import { dateOnlyField } from "./common.schema.js";

const dateStr = (label: string) =>
  dateOnlyField(label).nullable().optional().or(z.literal(""));

// A limit of 0 would let nobody enroll, so "no limit" is expressed as null
// rather than 0.
const userLimit = z.coerce
  .number({ error: "User limit must be a number." })
  .int("User limit must be a whole number.")
  .min(1, "User limit must be at least 1. Choose No Limit to allow everyone.")
  .max(1000000, "User limit looks too large. Please check the value.")
  .nullable()
  .optional();

export const createProgramSchema = z.object({
  name: z.string().trim().min(1, "Program name is required.").max(150),
  code: z.string().trim().max(50).nullable().optional().or(z.literal("")),
  description: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
  type: z.string().trim().max(50).nullable().optional().or(z.literal("")),
  startDate: dateStr("Start date"),
  endDate: dateStr("End date"),
  userLimit,
  isActive: z.boolean().optional(),
  showToFarmers: z.boolean().optional(),
  // Left out or null the program starts from the Global template, "blank" starts it empty, an id copies that template.
  // Only with "blank": whether the assessment holds multiple choice or input based questions.
  questionKind: z.enum(["mcq", "input"], { error: "Choose multiple choice or input based." }).optional(),
  // The name the program's own assessment goes by, and is listed and reused under.
  assessmentTemplateName: z
    .string()
    .trim()
    .min(2, "Give the template a name of at least two characters.")
    .max(150, "The name must be 150 characters or fewer.")
    .optional(),
  assessmentTemplateId: z
    .string()
    .trim()
    .refine((v) => v === "blank" || z.uuid().safeParse(v).success, {
      message: "Choose a valid assessment template.",
    })
    .nullable()
    .optional(),
});

// The toggle on its own, so the list row can flip it without sending a program.
export const setProgramVisibilitySchema = z.object({
  showToFarmers: z.boolean({ error: "Choose whether to show this program." }),
});

export const updateProgramSchema = createProgramSchema.partial();

export const listProgramsQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(10, 100),
  // The same four the panel shows, so the filter matches the badges.
  status: z
    .enum(["active", "inactive", "ended", "scheduled"], {
      error: "Choose a valid status.",
    })
    .optional(),
  search: z.string().trim().max(100).optional(),
});

export const codeSuggestionQuerySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the program name first.")
    .max(150, "Program name is too long."),
});

export const enrollFarmerSchema = z.object({
  farmerId: z.string({ error: "A farmer is required." }).uuid("Invalid farmer id."),
  fieldIds: z
    .array(z.string().uuid("Invalid field id."))
    .min(1, "Select at least one field."),
  assessorId: z.string().uuid("Invalid assessor id.").nullable().optional(),
  note: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});

export const setEnrollmentAssessorSchema = z.object({
  assessorId: z.string().uuid("Invalid assessor id.").nullable().optional(),
});

export const selfEnrollSchema = z.object({
  fieldIds: z
    .array(z.string().uuid("Invalid field id."))
    .min(1, "Select at least one field."),
  note: z.string().trim().max(500).nullable().optional().or(z.literal("")),
});

export const listEnrollmentsQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(10, 100),
  search: z.string().trim().max(100).optional(),
  assessor: z.enum(["assigned", "unassigned"]).optional(),
});

export const listSubmissionsQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(20, 100),
  programId: z.string().uuid("Invalid program id.").optional(),
  fieldId: z.string().uuid("Invalid field id.").optional(),
  authorRole: z.enum(["farmer", "assessor"]).optional(),
  reviewStatus: z.enum(["in_review", "approved"]).optional(),
});

export const updateEnrollmentFieldsSchema = z.object({
  fieldIds: z
    .array(z.string().uuid("Invalid field id."))
    .min(1, "Select at least one field."),
});

export const programIdParamSchema = z.object({
  id: z.string().uuid("Invalid program id."),
});

export const enrollmentParamsSchema = z.object({
  id: z.string().uuid("Invalid program id."),
  enrollmentId: z.string().uuid("Invalid enrollment id."),
});

export const selfUnenrollParamsSchema = z.object({
  id: z.string().uuid("Invalid program id."),
  fieldId: z.string().uuid("Invalid field id."),
});

export type CreateProgramBody = z.infer<typeof createProgramSchema>;
export type UpdateProgramBody = z.infer<typeof updateProgramSchema>;
export type ListProgramsQuery = z.infer<typeof listProgramsQuerySchema>;
export type SetProgramVisibilityBody = z.infer<
  typeof setProgramVisibilitySchema
>;
export type EnrollFarmerBody = z.infer<typeof enrollFarmerSchema>;
export type UpdateEnrollmentFieldsBody = z.infer<typeof updateEnrollmentFieldsSchema>;
export type SetEnrollmentAssessorBody = z.infer<typeof setEnrollmentAssessorSchema>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type SelfEnrollBody = z.infer<typeof selfEnrollSchema>;
export type ListEnrollmentsQuery = z.infer<typeof listEnrollmentsQuerySchema>;
