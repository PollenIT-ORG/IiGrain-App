import { z } from "zod";

export const fieldDetailsQuerySchema = z.object({
  tab: z.enum(["overview", "history", "soil", "docs"]).default("overview"),
});

const num = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .nonnegative(`${label} cannot be negative.`)
    .nullable()
    .optional();

export const upsertSoilSchema = z
  .object({
    ph: z.coerce
      .number({ error: "pH must be a number." })
      .min(0, "pH must be between 0 and 14.")
      .max(14, "pH must be between 0 and 14.")
      .nullable()
      .optional(),
    organicMatter: num("Organic matter"),
    nitrogen: num("Nitrogen"),
    phosphorus: num("Phosphorus"),
    potassium: num("Potassium"),
    moisture: num("Moisture"),
    texture: z.string().trim().max(50).nullable().optional().or(z.literal("")),
    notes: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
    testedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tested date must be YYYY-MM-DD.")
      .nullable()
      .optional()
      .or(z.literal("")),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "Provide at least one soil field.",
  });

export const createDocumentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional().or(z.literal("")),
});

export const fieldDocParamsSchema = z.object({
  id: z.string().uuid("Invalid field id."),
  docId: z.string().uuid("Invalid document id."),
});

export type FieldDetailsQuery = z.infer<typeof fieldDetailsQuerySchema>;
export type UpsertSoilBody = z.infer<typeof upsertSoilSchema>;
