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
  if (!/^\+?[0-9]{8,15}$/.test(v.replace(/[\s-]/g, ""))) {
    return "Enter a valid mobile number with country code.";
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

export function positiveNumber(
  value: string,
  { req = false, label = "Value" } = {}
): string | null {
  const v = value.trim();
  if (v === "") return req ? `${label} is required.` : null;
  const n = Number(v);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n <= 0) return `${label} must be greater than zero.`;
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
