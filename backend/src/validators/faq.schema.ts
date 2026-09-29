import { z } from "zod";
import { pageField, limitField } from "./pagination.schema.js";

const questionField = z
  .string({ error: "A question is required." })
  .trim()
  .min(5, "The question must be at least 5 characters.")
  .max(300, "The question must be at most 300 characters.");

const answerField = z
  .string({ error: "An answer is required." })
  .trim()
  .min(5, "The answer must be at least 5 characters.")
  .max(5000, "The answer must be at most 5000 characters.");

const sortOrderField = z.coerce
  .number({ error: "Order must be a number." })
  .int("Order must be a whole number.")
  .min(0, "Order cannot be negative.")
  .max(100000, "Order is too large.");

export const createFaqSchema = z.object({
  question: questionField,
  answer: answerField,
  sortOrder: sortOrderField.optional(),
  isActive: z.boolean().optional(),
});

export const updateFaqSchema = z
  .object({
    question: questionField.optional(),
    answer: answerField.optional(),
    sortOrder: sortOrderField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "Provide at least one field to update.",
  });

export const listFaqsQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(50, 200),
  status: z.enum(["active", "inactive"]).optional(),
  search: z.string().trim().max(200).optional(),
});

// The panel sends the whole list back in its new order after a drag.
export const reorderFaqsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid("Invalid FAQ id."),
        sortOrder: sortOrderField,
      })
    )
    .min(1, "Nothing to reorder.")
    .max(500, "You can reorder at most 500 items at a time."),
});

export type CreateFaqBody = z.infer<typeof createFaqSchema>;
export type UpdateFaqBody = z.infer<typeof updateFaqSchema>;
export type ListFaqsQuery = z.infer<typeof listFaqsQuerySchema>;
export type ReorderFaqsBody = z.infer<typeof reorderFaqsSchema>;
