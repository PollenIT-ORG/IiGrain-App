import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .string()
    .transform((v) => v === "true")
    .optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid("Invalid notification id."),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
