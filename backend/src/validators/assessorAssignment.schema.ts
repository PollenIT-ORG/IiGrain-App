import { z } from "zod";
import { pageField, limitField } from "./pagination.schema.js";

export const assignAssessorSchema = z.object({
  assessorId: z.string({ error: "An assessor is required." }).uuid("Invalid assessor id."),
  farmerId: z.string({ error: "A farmer is required." }).uuid("Invalid farmer id."),
  note: z.string().trim().max(500, "Note is too long.").optional().or(z.literal("")),
});

export const listAssignmentsQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(10, 100),
  assessorId: z.string().uuid("Invalid assessor id.").optional(),
  farmerId: z.string().uuid("Invalid farmer id.").optional(),
});

export const assignmentIdParamSchema = z.object({
  id: z.string().uuid("Invalid assignment id."),
});

export type AssignAssessorBody = z.infer<typeof assignAssessorSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
