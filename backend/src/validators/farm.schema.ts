import { z } from "zod";

const nameField = z
  .string({ error: "Farm name is required." })
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(150, "Name must be at most 150 characters.");

const areaField = z.coerce
  .number({ error: "Area must be a number." })
  .positive("Area must be greater than zero.")
  .max(9999999, "Area looks too large. Please check the value.")
  .optional();

const requiredAreaField = z.coerce
  .number({ error: "Farm area (acres) is required." })
  .positive("Area must be greater than zero.")
  .max(9999999, "Area looks too large. Please check the value.");

const ownerField = z
  .string({ error: "An owner (farmer) is required." })
  .uuid("Invalid owner id.");

const optionalOrg = z
  .string()
  .uuid("Invalid organization id.")
  .optional()
  .or(z.literal(""));

const optionalLocation = z
  .string()
  .trim()
  .max(500, "Location must be at most 500 characters.")
  .optional()
  .or(z.literal(""));

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

export const createFarmSchema = z.object({
  name: nameField,
  areaAcres: requiredAreaField,
  location: optionalLocation,
  latitude: latitudeField,
  longitude: longitudeField,
  ownerId: ownerField,
  orgId: optionalOrg,
  isActive: z.boolean().optional(),
});

export const createMyFarmSchema = z.object({
  name: nameField,
  areaAcres: requiredAreaField,
  location: optionalLocation,
  latitude: latitudeField,
  longitude: longitudeField,
  isActive: z.boolean().optional(),
});

export const updateFarmSchema = z
  .object({
    name: nameField.optional(),
    areaAcres: areaField,
    location: optionalLocation,
    latitude: latitudeField,
    longitude: longitudeField,
    ownerId: ownerField.optional(),
    orgId: optionalOrg,
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "Provide at least one field to update.",
  });

export const updateMyFarmSchema = z
  .object({
    name: nameField.optional(),
    areaAcres: areaField,
    location: optionalLocation,
    latitude: latitudeField,
    longitude: longitudeField,
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "Provide at least one field to update.",
  });

export const listFarmsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["active", "inactive"]).optional(),
  ownerId: z.string().uuid("Invalid owner id.").optional(),
  orgId: z.string().uuid("Invalid organization id.").optional(),
  search: z.string().trim().max(100).optional(),
});

export type CreateFarmBody = z.infer<typeof createFarmSchema>;
export type CreateMyFarmBody = z.infer<typeof createMyFarmSchema>;
export type UpdateFarmBody = z.infer<typeof updateFarmSchema>;
export type UpdateMyFarmBody = z.infer<typeof updateMyFarmSchema>;
export type ListFarmsQuery = z.infer<typeof listFarmsQuerySchema>;
