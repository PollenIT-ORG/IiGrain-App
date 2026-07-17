import { z } from "zod";

export const assignAssessorSchema = z.object({
  assessorId: z.string({ error: "An assessor is required." }).uuid("Invalid assessor id."),
  farmerId: z.string({ error: "A farmer is required." }).uuid("Invalid farmer id."),
  note: z.string().trim().max(500, "Note is too long.").optional().or(z.literal("")),
});

export const listAssignmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  assessorId: z.string().uuid("Invalid assessor id.").optional(),
  farmerId: z.string().uuid("Invalid farmer id.").optional(),
});

export const assignmentIdParamSchema = z.object({
  id: z.string().uuid("Invalid assignment id."),
});

export type AssignAssessorBody = z.infer<typeof assignAssessorSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
