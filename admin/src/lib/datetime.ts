// Every date and time in the panel is shown in the organization's timezone and
// on the clock it chose, so two people looking at the same record see the same
// thing wherever they are. The platform team sets both in Settings.

export interface LocaleSettings {
  timezone: string;
  timeFormat: "12h" | "24h";
}

const DEFAULTS: LocaleSettings = {
  timezone: "America/Chicago",
  timeFormat: "12h",
};

const STORE_KEY = "farmer_admin_locale";

function load(): LocaleSettings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as LocaleSettings) };
  } catch {
    // A stored value we cannot read is no worse than none.
  }
  return DEFAULTS;
}

// Kept in a module so plain functions can format without a React hook, and
// remembered so the first paint after a reload already uses the right clock.
let settings: LocaleSettings = load();

export function getLocaleSettings(): LocaleSettings {
  return settings;
}

// Screens showing dates need to redraw when the clock changes, and the change
// can come from another person saving it in Settings, so the panel watches
// this rather than only reading it on the first paint.
const listeners = new Set<() => void>();
let version = 0;

export function subscribeToLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Changes whenever the timezone or the clock does. */
export function getLocaleVersion(): number {
  return version;
}

export function setLocaleSettings(next: Partial<LocaleSettings>): void {
  const updated: LocaleSettings = {
    timezone: next.timezone?.trim() || settings.timezone,
    timeFormat: next.timeFormat ?? settings.timeFormat,
  };
  const changed =
    updated.timezone !== settings.timezone ||
    updated.timeFormat !== settings.timeFormat;
  settings = updated;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing: the settings still apply for this session.
  }
  if (changed) {
    version += 1;
    listeners.forEach((fn) => fn());
  }
}

function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function options(extra: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  return {
    timeZone: settings.timezone,
    hour12: settings.timeFormat === "12h",
    ...extra,
  };
}

/** 08 Aug 2026 */
export function fmtDate(
  value: string | Date | null | undefined,
  fallback = "-"
): string {
  const d = parse(value);
  if (!d) return fallback;
  return d.toLocaleDateString(
    undefined,
    options({ day: "2-digit", month: "short", year: "numeric" })
  );
}

/** 05:18 PM */
export function fmtTime(
  value: string | Date | null | undefined,
  fallback = "-"
): string {
  const d = parse(value);
  if (!d) return fallback;
  return d.toLocaleTimeString(
    undefined,
    options({ hour: "2-digit", minute: "2-digit" })
  );
}

/** 08 Aug 2026, 05:18 PM */
export function fmtDateTime(
  value: string | Date | null | undefined,
  fallback = "-"
): string {
  const d = parse(value);
  if (!d) return fallback;
  return `${fmtDate(d)}, ${fmtTime(d)}`;
}

/** The timezone as people read it, e.g. "CDT". */
export function timezoneLabel(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: settings.timezone,
    timeZoneName: "short",
  }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? settings.timezone;
}

// The timezones this platform works across. Anything else can still be stored;
// this is just the list offered in settings.
export const TIMEZONES = [
  { value: "America/Chicago", label: "Central Time (CST/CDT)" },
  { value: "America/New_York", label: "Eastern Time (EST/EDT)" },
  { value: "America/Denver", label: "Mountain Time (MST/MDT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PST/PDT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKST/AKDT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Europe/London", label: "United Kingdom (GMT/BST)" },
];

export const TIME_FORMATS = [
  { value: "12h", label: "12 hour (05:18 PM)" },
  { value: "24h", label: "24 hour (17:18)" },
];
