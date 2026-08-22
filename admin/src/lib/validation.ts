// Use the "max" metadata: it validates real number length and prefix per
// country (rejecting, e.g., an Indian number with too many digits), unlike the
// default "min" metadata which is lenient.
import { isValidPhoneNumber } from "react-phone-number-input/max";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function required(value: string, label = "This field"): string | null {
  return value.trim() === "" ? `${label} is required.` : null;
}

export function requiredEmail(value: string, label = "Email"): string | null {
  const v = value.trim();
  if (v === "") return `${label} is required.`;
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return null;
}

export function optionalEmail(value: string): string | null {
  const v = value.trim();
  if (v === "") return null;
  return EMAIL_RE.test(v) ? null : "Enter a valid email address.";
}

export function password(value: string, label = "Password"): string | null {
  if (value === "") return `${label} is required.`;
  if (value.length < 8) return `${label} must be at least 8 characters.`;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return `${label} must include at least one letter and one number.`;
  }
  return null;
}

export function phone(
  value: string,
  { req = false, label = "Mobile number" } = {}
): string | null {
  const v = value.trim();
  if (v === "") return req ? `${label} is required.` : null;
  // Country-aware check (libphonenumber via react-phone-number-input): rejects
  // wrong-length and wrong-prefix numbers, not just a loose digit count. The
  // value is E.164 ("+CC..."), what our PhoneInput emits.
  if (!isValidPhoneNumber(v)) {
    return "Enter a valid phone number with country code.";
  }
  return null;
}

export function minLen(
  value: string,
  min: number,
  label = "This field"
): string | null {
  const v = value.trim();
  if (v === "") return `${label} is required.`;
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  return null;
}

// The upper bound a piece of land can sensibly carry. The same number is the
// ceiling in the backend schemas, so the message appears under the box rather
// than coming back as a server error.
export const MAX_AREA_ACRES = 9999999;

export function positiveNumber(
  value: string,
  { req = false, label = "Value", max = Infinity } = {}
): string | null {
  const v = value.trim();
  if (v === "") return req ? `${label} is required.` : null;
  const n = Number(v);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n <= 0) return `${label} must be greater than zero.`;
  if (n > max) return `${label} looks too large. Please check the value.`;
  return null;
}

export function numberInRange(
  value: string,
  { req = false, min = 0, max = Infinity, label = "Value" } = {}
): string | null {
  const v = value.trim();
  if (v === "") return req ? `${label} is required.` : null;
  const n = Number(v);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n < min) return `${label} must be at least ${min}.`;
  if (n > max) return `${label} must be at most ${max}.`;
  return null;
}

export function requiredSelect(
  value: string,
  label = "This field"
): string | null {
  return value === "" ? `Please select ${label.toLowerCase()}.` : null;
}

export function isClean(errors: Record<string, string | null>): boolean {
  return Object.values(errors).every((e) => !e);
}
