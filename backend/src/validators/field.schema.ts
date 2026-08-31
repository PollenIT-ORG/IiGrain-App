import { z } from "zod";
import { dateOnlyField, uuidField } from "./common.schema.js";

// Both dates are optional, so this only rejects a pair that is present and
// backwards. A one-sided edit is checked in the service against the stored row.
function harvestNotBeforeSowing(d: {
  sowingDate?: string | null;
  expectedHarvest?: string | null;
}): boolean {
  if (!d.sowingDate || !d.expectedHarvest) return true;
  return d.expectedHarvest >= d.sowingDate;
}

const HARVEST_ORDER_ERROR = {
  message: "Expected harvest cannot be before the sowing date.",
  path: ["expectedHarvest"],
};

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

// Field boundary - a single closed GeoJSON Polygon ring. This is the only place
// untrusted geometry enters the system, so it is validated strictly rather than
// stored as opaque JSON.
const MAX_RING_POINTS = 2000;

const lngLatPosition = z.tuple([
  z.number().min(-180).max(180), // longitude comes first in GeoJSON
  z.number().min(-90).max(90), // latitude
]);

const closedLinearRing = z
  .array(lngLatPosition)
  .min(
    4,
    "A boundary ring needs at least 4 positions, with the last repeating the first."
  )
  .max(MAX_RING_POINTS, "A boundary ring has too many points.")
  .refine((ring) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    return first[0] === last[0] && first[1] === last[1];
  }, "The boundary ring must be closed (the last position must repeat the first).");

export const geoJSONPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(closedLinearRing).length(1), // outer ring only, no holes
});

export const saveFieldBoundarySchema = z.object({
  boundary: geoJSONPolygonSchema.nullable(),
});

export const createFieldSchema = z.object({
  farmId: uuidField("farm id").optional(),
  name: z
    .string({ error: "Field name is required." })
    .min(1, "Field name is required.")
    .max(150, "Field name must be 150 characters or fewer."),
  areaAcres: z.coerce
    .number({ error: "Area must be a number." })
    .positive("Area must be greater than zero.")
    .max(9999999, "Area looks too large. Please check the value.")
    .optional(),
  crop: z.string().max(100).optional(),
  season: z.string().max(100).optional(),
  irrigation: z.string().max(100).optional(),
  location: z.string().max(500, "Location is too long.").optional(),
  latitude: latitudeField,
  longitude: longitudeField,
  sowingDate: dateOnlyField("Sowing date").optional(),
  expectedHarvest: dateOnlyField("Expected harvest").optional(),
  isActive: z.boolean().optional(),
  // Optional: a field can be created now and traced later.
  boundary: geoJSONPolygonSchema.nullish(),
}).refine(harvestNotBeforeSowing, HARVEST_ORDER_ERROR);

export const updateFieldSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    areaAcres: z.coerce
      .number()
      .positive()
      .max(9999999, "Area looks too large. Please check the value.")
      .optional()
      .nullable(),
    crop: z.string().max(100).optional().nullable(),
    season: z.string().max(100).optional().nullable(),
    irrigation: z.string().max(100).optional().nullable(),
    location: z.string().max(500, "Location is too long.").optional().nullable(),
    latitude: latitudeField,
    longitude: longitudeField,
    sowingDate: dateOnlyField("Sowing date").optional().nullable(),
    expectedHarvest: dateOnlyField("Expected harvest").optional().nullable(),
    isActive: z.boolean().optional(),
    // Left out entirely keeps the stored boundary; null clears it.
    boundary: geoJSONPolygonSchema.nullish(),
  })
  .refine(
    (d) =>
      Object.values(d).some(
        (v) => v !== undefined
      ),
    { message: "At least one field must be provided to update." }
  )
  .refine(harvestNotBeforeSowing, HARVEST_ORDER_ERROR);

export const listFieldsQuerySchema = z.object({
  page: z.coerce
    .number({ error: "Page must be a number." })
    .int("Page must be a whole number.")
    .min(1, "Page must be 1 or higher.")
    .max(100000, "That page number is too high.")
    .optional()
    .default(1),
  limit: z.coerce
    .number({ error: "Limit must be a number." })
    .int("Limit must be a whole number.")
    .min(1, "Limit must be 1 or higher.")
    .max(100, "You can request at most 100 items per page.")
    .optional()
    .default(20),
  farmId: uuidField("farm id").optional(),
  ownerId: uuidField("owner id").optional(),
  isActive: z
    .enum(["true", "false"], { error: "isActive must be true or false." })
    .transform((v) => v === "true")
    .optional(),
  hasBoundary: z
    .enum(["true", "false"], { error: "hasBoundary must be true or false." })
    .transform((v) => v === "true")
    .optional(),
  search: z.string().trim().max(100).optional(),
});

