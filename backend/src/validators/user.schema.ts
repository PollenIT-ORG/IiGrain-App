import { z } from "zod";
import { pageField, limitField } from "./pagination.schema.js";
import {
  nameField,
  emailField,
  phoneField,
  passwordField,
} from "./auth.schema.js";

const ROLE_VALUES = [
  "farmer",
  "assessor",
  "program_partner",
  "program_administrator",
  "admin",
] as const;

const roleField = z.enum(ROLE_VALUES, {
  error:
    "Role must be one of: farmer, assessor, program_partner, program_administrator, admin.",
});

// No password here on purpose: the server generates a temporary one and emails
// it, so nobody in the office ever knows what another person's password is.
export const createUserSchema = z.object({
  fullName: nameField,
  email: emailField,
  phone: phoneField,
  role: roleField,
  isActive: z.boolean().optional(),
});

export const updateUserSchema = z
  .object({
    fullName: nameField.optional(),
    phone: phoneField.optional(),
    role: roleField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Provide at least one field to update.",
  });

export const setStatusSchema = z.object({
  isActive: z.boolean({ error: "isActive must be true or false." }),
});

export const listUsersQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(10, 100),
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  search: z.string().trim().max(100).optional(),
  assessor: z.enum(["assigned", "unassigned"]).optional(),
});

export const assignAssessorToUserSchema = z.object({
  assessorId: z
    .string({ error: "An assessor is required." })
    .uuid("Invalid assessor id."),
});

export const updateProfileSchema = z
  .object({
    fullName: nameField.optional(),
    phone: phoneField.optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Provide at least one field to update.",
  });

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ error: "Current password is required." })
    .min(1, "Current password is required.")
    .max(200, "That password is too long."),
  newPassword: passwordField,
});

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type SetStatusBody = z.infer<typeof setStatusSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type AssignAssessorToUserBody = z.infer<typeof assignAssessorToUserSchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
