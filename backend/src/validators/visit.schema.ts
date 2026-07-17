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
});

export const endVisitSchema = z.object({
  outcome: z.enum(["completed", "cancelled"]).optional().default("completed"),
});

export const visitIdParamSchema = z.object({
  id: z.string().uuid("Invalid visit id."),
});

export type StartVisitBody = z.infer<typeof startVisitSchema>;
export type LocationBody = z.infer<typeof locationSchema>;
export type EndVisitBody = z.infer<typeof endVisitSchema>;
