import { z } from "zod";

// Shared page/limit so every list endpoint rejects bad values with the same
// readable wording instead of leaking zod's internal phrasing.
export const pageField = (def = 1) =>
  z.coerce
    .number({ error: "Page must be a number." })
    .int("Page must be a whole number.")
    .min(1, "Page must be 1 or higher.")
    .max(100000, "That page number is too high.")
    .default(def);

export const limitField = (def = 20, max = 100) =>
  z.coerce
    .number({ error: "Limit must be a number." })
    .int("Limit must be a whole number.")
    .min(1, "Limit must be 1 or higher.")
    .max(max, `You can request at most ${max} items per page.`)
    .default(def);

export const searchField = z
  .string()
  .trim()
  .max(100, "Search text is too long.")
  .optional();

export const paginationQuerySchema = z.object({
  page: pageField(),
  limit: limitField(),
  search: searchField,
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
