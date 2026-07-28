import { z } from "zod";
import { dateOnlyField } from "./common.schema.js";

export const fieldDetailsQuerySchema = z.object({
  tab: z.enum(["overview", "history", "soil", "docs"]).default("overview"),
});

// Nutrient readings are ppm, so the ceiling only exists to catch typos.
const num = (label: string, max = 10000) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .nonnegative(`${label} cannot be negative.`)
    .max(max, `${label} cannot be more than ${max}.`)
    .nullable()
    .optional();

const percent = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .min(0, `${label} must be between 0 and 100.`)
    .max(100, `${label} must be between 0 and 100.`)
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
    organicMatter: percent("Organic matter"),
    nitrogen: num("Nitrogen"),
    phosphorus: num("Phosphorus"),
    potassium: num("Potassium"),
    moisture: percent("Moisture"),
    texture: z.string().trim().max(50).nullable().optional().or(z.literal("")),
    notes: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
    testedOn: dateOnlyField("Tested date")
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
