import { z } from "zod";

// Shared building blocks so ids and dates are rejected by the validator with a
// readable message instead of failing later inside the database driver.

export function uuidField(label: string) {
  return z.string().uuid(`Invalid ${label}.`);
}

export const idParamSchema = z.object({ id: uuidField("id") });

function isRealDate(value: string): boolean {
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

// A YYYY-MM-DD string that is also a real calendar day, so "2026-99-99" and
// "2026-02-30" are refused up front.
export function dateOnlyField(label: string) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be in YYYY-MM-DD format.`)
    .refine(isRealDate, `${label} is not a real date.`);
}
