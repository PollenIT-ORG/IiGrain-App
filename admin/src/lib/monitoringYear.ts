import type { ModuleRecord } from "../types";

/** The date column each module is filed under, in the order it is looked for. */
const DATE_KEYS = [
  "training_date",
  "sample_date",
  "irrigation_date",
  "tillage_date",
  "planting_date",
  "event_date",
  "application_date",
] as const;

/** A record with no date of its own is filed under the year it was created. */
export function yearOfRecord(record: ModuleRecord): string {
  for (const key of DATE_KEYS) {
    const raw = record[key];
    if (typeof raw === "string" && /^\d{4}/.test(raw)) return raw.slice(0, 4);
  }
  return String(record.created_at ?? "").slice(0, 4) || currentYear();
}

export function currentYear(): string {
  return String(new Date().getFullYear());
}

/** Every year present in a set of records, newest first. */
export function yearsInRecords(records: ModuleRecord[]): string[] {
  return [...new Set(records.map(yearOfRecord))].sort().reverse();
}
