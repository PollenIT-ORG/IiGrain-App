import { z } from "zod";

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
  .nullable()
  .optional()
  .or(z.literal(""));

const userLimit = z.coerce
  .number({ error: "User limit must be a number." })
  .int("User limit must be a whole number.")
  .min(0, "User limit cannot be negative.")
  .nullable()
  .optional();

export const createProgramSchema = z.object({
  name: z.string().trim().min(1, "Program name is required.").max(150),
  code: z.string().trim().max(50).nullable().optional().or(z.literal("")),
  description: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
  type: z.string().trim().max(50).nullable().optional().or(z.literal("")),
  startDate: dateStr,
  endDate: dateStr,
  userLimit,
  isActive: z.boolean().optional(),
});

export const updateProgramSchema = createProgramSchema.partial();

export const listProgramsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  search: z.string().trim().max(100).optional(),
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
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  assessor: z.enum(["assigned", "unassigned"]).optional(),
});

export const listSubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  programId: z.string().uuid("Invalid program id.").optional(),
  authorRole: z.enum(["farmer", "assessor"]).optional(),
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

export type CreateProgramBody = z.infer<typeof createProgramSchema>;
export type UpdateProgramBody = z.infer<typeof updateProgramSchema>;
export type ListProgramsQuery = z.infer<typeof listProgramsQuerySchema>;
export type EnrollFarmerBody = z.infer<typeof enrollFarmerSchema>;
export type UpdateEnrollmentFieldsBody = z.infer<typeof updateEnrollmentFieldsSchema>;
export type SetEnrollmentAssessorBody = z.infer<typeof setEnrollmentAssessorSchema>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type SelfEnrollBody = z.infer<typeof selfEnrollSchema>;
export type ListEnrollmentsQuery = z.infer<typeof listEnrollmentsQuerySchema>;
