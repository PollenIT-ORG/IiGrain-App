import { z } from "zod";
import { dateOnlyField } from "./common.schema.js";
import { MODULE_KEYS } from "../models/fieldModule.model.js";

/**
 * Validation for the field monitoring modules.
 *
 * Two rules shaped everything here:
 *
 * 1. Every ceiling is inside what the column can physically hold. A NUMERIC(5,2)
 *    stops at 999.99, so a percentage is capped at 100 rather than left open.
 *    Without that the database throws a numeric overflow, which reaches the user
 *    as a 500 instead of a readable message.
 *
 * 2. Nothing is required except the one thing that identifies a row. A farmer
 *    records what he did as he does it, often with the phone in one hand, so a
 *    half-filled entry has to be allowed to save. Completeness is expressed by
 *    the status, not by refusing to store the record.
 */

const STATUS = z.enum(["in_progress", "completed"], {
  error: "Status must be in progress or completed.",
});

const notes = z
  .string()
  .trim()
  .max(1000, "Notes are too long (limit 1000).")
  .optional()
  .nullable()
  .or(z.literal(""));

/** Optional short text with a ceiling that matches its column. */
const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long (limit ${max}).`)
    .optional()
    .nullable()
    .or(z.literal(""));

/** Optional number inside a range the column can actually store. */
const num = (min: number, max: number, label: string) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .min(min, `${label} cannot be less than ${min}.`)
    .max(max, `${label} cannot be more than ${max}.`)
    .optional()
    .nullable();

const optionalDate = (label: string) =>
  dateOnlyField(label).optional().nullable().or(z.literal(""));

const bool = z.boolean().optional().nullable();

/** A percentage. Every percent column is NUMERIC(6,2) or tighter. */
const pct = (label: string) => num(0, 100, label);

const base = { status: STATUS.optional(), notes };

// ---------------------------------------------------------------------------
// One schema per module. The keys match the columns exactly, because the model
// whitelists by column name.
// ---------------------------------------------------------------------------

export const moduleBodySchemas = {
  training: z.object({
    ...base,
    training_date: optionalDate("Training date"),
    topic: text(200, "Topic"),
    organizer: text(200, "Organizer"),
    hours: num(0, 999, "Hours"),
  }),

  soil_samples: z.object({
    ...base,
    // The only required field anywhere: a sampling point without a label cannot
    // be told apart from the others in the list.
    point_label: z
      .string({ error: "Point label is required." })
      .trim()
      .min(1, "Point label is required.")
      .max(60, "Point label is too long (limit 60)."),
    latitude: num(-90, 90, "Latitude"),
    longitude: num(-180, 180, "Longitude"),
    sample_date: optionalDate("Sample date"),
    soc_0_2: pct("SOC 0-2"),
    soc_2_6: pct("SOC 2-6"),
    was_0_2: pct("WAS 0-2"),
    soil_texture: text(100, "Soil texture"),
    soil_series: text(150, "Soil series"),
  }),

  irrigation: z.object({
    ...base,
    irrigation_date: optionalDate("Irrigation date"),
    irrigation_type: text(100, "Irrigation type"),
    amount_inches: num(0, 9999, "Amount in inches"),
    amount_gallons_ac: num(0, 9999999, "Amount in gallons per acre"),
    source: text(100, "Source"),
  }),

  pesticide: z.object({
    ...base,
    application_date: optionalDate("Application date"),
    product: text(200, "Product"),
    product_type: text(100, "Product type"),
    rate: num(0, 999999, "Rate"),
    rate_unit: text(50, "Rate unit"),
    application_method: text(100, "Application method"),
  }),

  fertilizer: z.object({
    ...base,
    application_date: optionalDate("Application date"),
    fertilizer_type: text(150, "Fertilizer type"),
    form: text(50, "Form"),
    application_method: text(100, "Application method"),
    rate_lbs_acre: num(0, 999999, "Rate in lbs per acre"),
    n_pct: pct("Nitrogen percent"),
    p2o5_pct: pct("Phosphate percent"),
    k2o_pct: pct("Potash percent"),
  }),

  tillage: z.object({
    ...base,
    tillage_date: optionalDate("Tillage date"),
    implement: text(150, "Implement"),
    tillage_type: text(100, "Tillage type"),
    depth_inches: num(0, 999, "Depth in inches"),
    residue_after_pct: pct("Residue after tillage"),
    residue_before_pct: pct("Residue before planting"),
    soil_moisture: text(50, "Soil moisture"),
  }),

  amendment: z.object({
    ...base,
    application_date: optionalDate("Application date"),
    amendment_type: text(150, "Amendment type"),
    source: text(100, "Source"),
    rate: num(0, 999999, "Rate"),
    rate_unit: text(50, "Rate unit"),
    n_pct: pct("Nitrogen percent"),
    p2o5_pct: pct("Phosphate percent"),
    k2o_pct: pct("Potash percent"),
    incorporated: bool,
  }),

  crop: z.object({
    ...base,
    crop_species: text(150, "Crop species"),
    // The worksheet only recognises these three, so anything else is refused
    // rather than quietly stored and failing the export later.
    // An empty select is turned into null first, so a wrong value still gets
    // the real message instead of a union complaining about "Invalid input".
    crop_type: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z
        .enum(["cash", "cover", "forage"], {
          error: "Crop type must be cash, cover or forage.",
        })
        .nullable()
    ),
    planting_date: optionalDate("Planting date"),
    harvest_date: optionalDate("Harvest date"),
    seeding_rate: num(0, 999999, "Seeding rate"),
    seeding_rate_unit: text(50, "Seeding rate unit"),
    yield_value: num(0, 9999999, "Yield"),
    yield_unit: text(50, "Yield unit"),
  }),

  nutrient: z.object({
    ...base,
    event_date: optionalDate("Event date"),
    variable_rate: bool,
    split_rate: bool,
    enhanced_efficiency: bool,
    application_method: text(100, "Application method"),
    n_pct: pct("Nitrogen percent"),
    p2o5_pct: pct("Phosphate percent"),
    k2o_pct: pct("Potash percent"),
    rate_lbs_acre: num(0, 999999, "Rate in lbs per acre"),
  }),
} as const;

/**
 * Harvest cannot come before planting. Checked here rather than in the service
 * so the message lands on the field in the form.
 */
export const cropCreateSchema = moduleBodySchemas.crop.refine(
  (v) =>
    !v.planting_date ||
    !v.harvest_date ||
    String(v.harvest_date) >= String(v.planting_date),
  { message: "Harvest date cannot be before the planting date.", path: ["harvest_date"] }
);

export function bodySchemaFor(module: string, partial: boolean) {
  const schema = moduleBodySchemas[module as keyof typeof moduleBodySchemas];
  if (!schema) return null;
  if (module === "crop") return partial ? moduleBodySchemas.crop.partial() : cropCreateSchema;
  return partial ? schema.partial() : schema;
}

// ---------------------------------------------------------------------------
// Params and queries
// ---------------------------------------------------------------------------

export const farmParamsSchema = z.object({
  farmId: z.string().uuid("Invalid farm id."),
});

export const farmProgramParamsSchema = z.object({
  farmId: z.string().uuid("Invalid farm id."),
  programId: z.string().uuid("Invalid program id."),
});

export const farmModuleParamsSchema = farmProgramParamsSchema.extend({
  module: z.enum(MODULE_KEYS as [string, ...string[]], {
    error: "Unknown module.",
  }),
});

export const moduleParamsSchema = z.object({
  programId: z.string().uuid("Invalid program id."),
  fieldId: z.string().uuid("Invalid field id."),
  module: z.enum(MODULE_KEYS as [string, ...string[]], {
    error: "Unknown module.",
  }),
});

export const moduleRecordParamsSchema = moduleParamsSchema.extend({
  id: z.string().uuid("Invalid record id."),
});

export const fieldProgramParamsSchema = z.object({
  programId: z.string().uuid("Invalid program id."),
  fieldId: z.string().uuid("Invalid field id."),
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

// "other" covers the loose files the admin panel uploads against no one row.
const DOCUMENT_MODULES: [string, ...string[]] = ["other", ...MODULE_KEYS];

export const createDocumentSchema = z.object({
  module: z.enum(DOCUMENT_MODULES, { error: "Unknown module." }),
  // Left out when the file belongs to the module rather than to one row.
  recordId: z.string().uuid("Invalid record id.").optional().nullable(),
  kind: z
    .enum(["document", "photo", "lab_report", "certificate"], {
      error: "Unknown document kind.",
    })
    .optional(),
  name: z
    .string({ error: "File name is required." })
    .trim()
    .min(1, "File name is required.")
    .max(200, "File name is too long (limit 200)."),
  url: z
    .string({ error: "File URL is required." })
    .trim()
    .url("File URL is not valid.")
    .max(2000, "File URL is too long."),
  mimeType: z.string().trim().max(100).optional().nullable(),
  // 10 MB, the same ceiling the upload box shows.
  sizeBytes: z.coerce
    .number()
    .int()
    .min(0)
    .max(10 * 1024 * 1024, "That file is larger than 10 MB.")
    .optional()
    .nullable(),
});

/**
 * The multipart form that carries an actual file. The name, url, type and size
 * are not accepted from the client here: they are read off the uploaded file
 * itself, so a caller cannot claim a 1 KB file and send 50 MB.
 */
export const uploadDocumentSchema = z.object({
  module: z.enum(DOCUMENT_MODULES, { error: "Unknown module." }),
  recordId: z.string().uuid("Invalid record id.").optional().nullable(),
  kind: z
    .enum(["document", "photo", "lab_report", "certificate"], {
      error: "Unknown document kind.",
    })
    .optional(),
});

export const listDocumentsQuerySchema = z.object({
  module: z.enum(DOCUMENT_MODULES).optional(),
  recordId: z.string().uuid("Invalid record id.").optional(),
});

export const documentParamsSchema = fieldProgramParamsSchema.extend({
  documentId: z.string().uuid("Invalid document id."),
});

export type CreateDocumentBody = z.infer<typeof createDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
export type UploadDocumentBody = z.infer<typeof uploadDocumentSchema>;
