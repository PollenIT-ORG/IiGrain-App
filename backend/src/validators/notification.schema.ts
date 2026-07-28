import { z } from "zod";
import { pageField, limitField } from "./pagination.schema.js";

export const listNotificationsQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(20, 100),
  unreadOnly: z
    .string()
    .transform((v) => v === "true")
    .optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid("Invalid notification id."),
});

export const deleteNotificationsSchema = z.object({
  ids: z
    .array(z.string().uuid("Invalid notification id."))
    .min(1, "Select at least one notification.")
    .max(200, "You can delete at most 200 at a time."),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type DeleteNotificationsBody = z.infer<typeof deleteNotificationsSchema>;
