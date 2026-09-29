import { z } from "zod";
import { pageField, limitField } from "./pagination.schema.js";

// The form is public: it has to work for someone whose account was deactivated
// and who therefore cannot sign in to report it. Everything below is written by
// a stranger, so each field is bounded and checked here rather than at the row.

const NUL = String.fromCharCode(0);

// Postgres text cannot hold a NUL, so one reaching the driver becomes a 500.
function noNullBytes<T extends z.ZodType<string>>(field: T) {
  return field.refine((v) => v.indexOf(NUL) === -1, {
    message: "Remove the invalid character and try again.",
  });
}

const nameField = noNullBytes(
  z
    .string({ error: "Your name is required." })
    .trim()
    .min(2, "Your name must be at least 2 characters.")
    .max(150, "Your name must be at most 150 characters.")
);

const emailField = z
  .string({ error: "Your email is required." })
  .trim()
  .min(1, "Your email is required.")
  .max(255, "The email must be at most 255 characters.")
  .email("Enter a valid email address.")
  .toLowerCase();

// Optional, and blank is treated as not given rather than as a bad number.
const phoneField = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine(
    (v) => v === "" || (/^\+?[0-9\s-]{8,20}$/.test(v) && v.replace(/\D/g, "").length >= 8),
    { message: "Enter a valid phone number, or leave it blank." }
  )
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const subjectField = noNullBytes(
  z
    .string({ error: "A subject is required." })
    .trim()
    .min(3, "The subject must be at least 3 characters.")
    .max(150, "The subject must be at most 150 characters.")
);

const messageField = noNullBytes(
  z
    .string({ error: "Please describe the issue." })
    .trim()
    .min(10, "Please describe the issue in at least 10 characters.")
    .max(5000, "The description must be at most 5000 characters.")
);

export const createContactEnquirySchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
  subject: subjectField,
  message: messageField,
});

export const listContactEnquiriesQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(20, 100),
  // read and unread say whether it was opened; resolved and open say whether it
  // was dealt with.
  status: z.enum(["read", "unread", "resolved", "open"]).optional(),
  search: z.string().trim().max(200).optional(),
});

export const setEnquiryReadSchema = z.object({
  isRead: z.boolean({ error: "isRead must be true or false." }),
});

export const setEnquiryResolvedSchema = z.object({
  isResolved: z.boolean({ error: "isResolved must be true or false." }),
});

// The panel sends the ticked rows. Capped so one request cannot sweep the table.
export const bulkDeleteEnquiriesSchema = z.object({
  ids: z
    .array(z.string().uuid("Invalid enquiry id."))
    .min(1, "Select at least one enquiry.")
    .max(100, "You can delete at most 100 at a time."),
});

// What the office writes back. A producer reads this, so it is bounded and
// checked as tightly as the form they wrote in with.
export const replyToEnquirySchema = z.object({
  subject: noNullBytes(
    z
      .string({ error: "A subject is required." })
      .trim()
      .min(3, "The subject must be at least 3 characters.")
      .max(150, "The subject must be at most 150 characters.")
  ),
  message: noNullBytes(
    z
      .string({ error: "Write the reply before sending it." })
      .trim()
      .min(10, "The reply must be at least 10 characters.")
      .max(5000, "The reply must be at most 5000 characters.")
  ),
  // Answering usually finishes the job, but the panel decides that, not this.
  resolve: z.boolean().optional(),
});

export type CreateContactEnquiryBody = z.infer<typeof createContactEnquirySchema>;
export type ListContactEnquiriesQuery = z.infer<typeof listContactEnquiriesQuerySchema>;
export type SetEnquiryReadBody = z.infer<typeof setEnquiryReadSchema>;
export type SetEnquiryResolvedBody = z.infer<typeof setEnquiryResolvedSchema>;
export type BulkDeleteEnquiriesBody = z.infer<typeof bulkDeleteEnquiriesSchema>;
export type ReplyToEnquiryBody = z.infer<typeof replyToEnquirySchema>;
