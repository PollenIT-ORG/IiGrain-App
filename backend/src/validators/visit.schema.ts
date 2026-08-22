import { z } from "zod";

export const startVisitSchema = z.object({
  fieldId: z.string().uuid("Please select a field to visit."),
});

export const locationSchema = z.object({
  latitude: z.coerce
    .number({ error: "Latitude must be a number." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90."),
  longitude: z.coerce
    .number({ error: "Longitude must be a number." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180."),
  accuracy_m: z.coerce.number().min(0).optional(),
  is_mock: z.coerce.boolean().optional(),
});

// Arrival carries the assessor's position so the server can geofence it. All
// optional: a client that sends nothing simply records an unverified arrival.
export const arriveSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  accuracy_m: z.coerce.number().min(0).optional(),
  is_mock: z.coerce.boolean().optional(),
  captured_at: z.string().optional(),
});

export const endVisitSchema = z.object({
  outcome: z.enum(["completed", "cancelled"]).optional().default("completed"),
});

export const visitIdParamSchema = z.object({
  id: z.string().uuid("Invalid visit id."),
});

export type StartVisitBody = z.infer<typeof startVisitSchema>;
export type LocationBody = z.infer<typeof locationSchema>;
export type ArriveBody = z.infer<typeof arriveSchema>;
export type EndVisitBody = z.infer<typeof endVisitSchema>;
