/**
 * Character limits the backend actually enforces.
 *
 * Mirrored here so inputs can stop accepting text at exactly the point the API
 * would reject it — the user simply cannot type an invalid value, so there is
 * no failed round-trip and no error to show.
 *
 * These are NOT extra client-side rules: every entry below matches a `.max()`
 * in the backend validators. A field the backend leaves unbounded (e.g. a
 * field's `location`) is deliberately absent — do not invent a cap for it.
 *
 * Source of truth:
 *   backend/src/validators/farm.schema.ts
 *   backend/src/validators/field.schema.ts
 *   backend/src/validators/fieldDetails.schema.ts
 * Keep this file in sync when those change.
 */
export const API_LIMITS = {
  farm: {
    name: 150,
    location: 500,
    businessEntity: 200,
  },
  field: {
    name: 150,
    crop: 100,
    season: 100,
    irrigation: 100,
    // `location` is unbounded in field.schema.ts — intentionally omitted.
  },
  soil: {
    texture: 50,
    notes: 2000,
  },
} as const;
