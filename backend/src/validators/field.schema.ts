import { z } from "zod";

const FIELD_STATUSES = ["healthy", "monitor", "critical"] as const;

const latitudeField = z.coerce
  .number({ error: "Latitude must be a number." })
  .min(-90, "Latitude must be between -90 and 90.")
  .max(90, "Latitude must be between -90 and 90.")
  .optional()
  .nullable();

const longitudeField = z.coerce
  .number({ error: "Longitude must be a number." })
  .min(-180, "Longitude must be between -180 and 180.")
  .max(180, "Longitude must be between -180 and 180.")
  .optional()
  .nullable();

export const createFieldSchema = z.object({
  farmId: z.string().uuid({ message: "Farm ID must be a valid UUID." }).optional(),
  name: z
    .string({ error: "Field name is required." })
    .min(1, "Field name is required.")
    .max(150, "Field name must be 150 characters or fewer."),
  areaAcres: z.coerce
    .number({ error: "Area must be a number." })
    .positive("Area must be greater than zero.")
    .optional(),
  crop: z.string().max(100).optional(),
  season: z.string().max(100).optional(),
  irrigation: z.string().max(100).optional(),
  location: z.string().optional(),
  latitude: latitudeField,
  longitude: longitudeField,
  sowingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Sowing date must be YYYY-MM-DD.")
    .optional(),
  expectedHarvest: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected harvest must be YYYY-MM-DD.")
    .optional(),
  status: z.enum(FIELD_STATUSES).optional(),
  isActive: z.boolean().optional(),
});

export const updateFieldSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    areaAcres: z.coerce.number().positive().optional().nullable(),
    crop: z.string().max(100).optional().nullable(),
    season: z.string().max(100).optional().nullable(),
    irrigation: z.string().max(100).optional().nullable(),
    location: z.string().optional().nullable(),
    latitude: latitudeField,
    longitude: longitudeField,
    sowingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Sowing date must be YYYY-MM-DD.")
      .optional()
      .nullable(),
    expectedHarvest: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected harvest must be YYYY-MM-DD.")
      .optional()
      .nullable(),
    status: z.enum(FIELD_STATUSES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) =>
      Object.values(d).some(
        (v) => v !== undefined
      ),
    { message: "At least one field must be provided to update." }
  );

export const listFieldsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  farmId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  status: z.enum(FIELD_STATUSES).optional(),
  isActive: z
    .string()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined))
    .optional(),
  search: z.string().optional(),
});
