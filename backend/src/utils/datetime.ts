import { findDefaultOrgBranding } from "../models/organization.model.js";

// One clock for the whole platform. The organization picks a timezone and a 12
// or 24 hour format in settings, and every date the server writes - emails,
// contracts, the signature line - is shown that way, not in UTC.

export interface Clock {
  timezone: string;
  hour12: boolean;
}

const FALLBACK: Clock = { timezone: "America/Chicago", hour12: true };

// The setting rarely changes, so it is held briefly rather than read per email.
let cached: { clock: Clock; at: number } | null = null;
const CACHE_MS = 60_000;

export async function getClock(): Promise<Clock> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.clock;
  try {
    const org = await findDefaultOrgBranding();
    const clock: Clock = {
      timezone: org?.timezone || FALLBACK.timezone,
      hour12: (org?.time_format ?? "12h") !== "24h",
    };
    cached = { clock, at: Date.now() };
    return clock;
  } catch {
    return FALLBACK;
  }
}

/**
 * Forgets the cached setting, so a change in settings takes effect at once.
 * clock.service.ts calls this the moment the setting is saved.
 */
export function clearClockCache(): void {
  cached = null;
}

function parts(
  date: Date,
  clock: Clock,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: clock.timezone,
    hour12: clock.hour12,
    ...options,
  }).format(date);
}

/**
 * Today on the organization's clock, as YYYY-MM-DD.
 *
 * Date-only columns (a program's start and end) are compared against this, so
 * a program ends at midnight where the office is, not at midnight UTC.
 */
export async function orgToday(): Promise<string> {
  const clock = await getClock();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: clock.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

/** 08 August 2026 */
export function formatDate(date: Date, clock: Clock): string {
  return parts(date, clock, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** 05:18 PM CDT */
export function formatTime(date: Date, clock: Clock): string {
  return parts(date, clock, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** 08 August 2026 at 05:18 PM CDT */
export function formatDateTime(date: Date, clock: Clock): string {
  return `${formatDate(date, clock)} at ${formatTime(date, clock)}`;
}
