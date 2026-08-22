import { z } from "zod";
import { pageField, limitField } from "./pagination.schema.js";

const nameField = z
  .string({ error: "Organization name is required." })
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(150, "Name must be at most 150 characters.");

const codeField = z
  .string({ error: "Code is required." })
  .trim()
  .min(2, "Code must be at least 2 characters.")
  .max(50, "Code must be at most 50 characters.");

const optionalEmail = z
  .string()
  .trim()
  .max(255)
  .email("Enter a valid contact email.")
  .optional()
  .or(z.literal(""));

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

// A timezone the browser and the server both understand, e.g. America/Chicago.
const timezoneField = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Choose a valid timezone." }
  )
  .optional();

const timeFormatField = z
  .enum(["12h", "24h"], { error: "Choose a 12 or 24 hour clock." })
  .optional();

export const createOrgSchema = z.object({
  name: nameField,
  code: codeField,
  description: optionalText(2000),
  contactEmail: optionalEmail,
  contactPhone: optionalText(20),
  contactHours: optionalText(200),
  address: optionalText(500),
  timezone: timezoneField,
  timeFormat: timeFormatField,
  isActive: z.boolean().optional(),
});

export const updateOrgSchema = z
  .object({
    name: nameField.optional(),
    code: codeField.optional(),
    description: optionalText(2000),
    contactEmail: optionalEmail,
    contactPhone: optionalText(20),
    contactHours: optionalText(200),
    address: optionalText(500),
    timezone: timezoneField,
    timeFormat: timeFormatField,
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "Provide at least one field to update.",
  });

export const listOrgsQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(10, 100),
  status: z.enum(["active", "inactive"]).optional(),
  search: z.string().trim().max(100).optional(),
});

export const assignUserSchema = z.object({
  userId: z.string({ error: "userId is required." }).uuid("Invalid userId."),
});

export type CreateOrgBody = z.infer<typeof createOrgSchema>;
export type UpdateOrgBody = z.infer<typeof updateOrgSchema>;
export type ListOrgsQuery = z.infer<typeof listOrgsQuerySchema>;
export type AssignUserBody = z.infer<typeof assignUserSchema>;
