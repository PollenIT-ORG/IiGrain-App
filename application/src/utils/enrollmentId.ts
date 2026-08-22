export const ENROLLMENT_ID_MAX_LENGTH = 32;

export const ENROLLMENT_ID_EXAMPLE = 'IIG-2026-123456';

const CANONICAL = /^IIG-\d{4}-\d{6}$/;

const GROUPABLE = /^IIG\d*$/;

const YEAR_DIGITS = 4;
const SERIAL_DIGITS = 6;

export const normalizeEnrollmentId = (raw: string): string =>
  raw.replace(/\s+/g, '').toUpperCase();

export const formatEnrollmentIdInput = (raw: string): string => {
  const cleaned = normalizeEnrollmentId(raw).slice(0, ENROLLMENT_ID_MAX_LENGTH);
  const compact = cleaned.replace(/-/g, '');

  if (!GROUPABLE.test(compact)) {
    return cleaned;
  }

  const digits = compact.slice(3);
  if (digits.length > YEAR_DIGITS + SERIAL_DIGITS) {
    return cleaned;
  }

  let out = 'IIG';
  if (digits.length > 0) {
    out += `-${digits.slice(0, YEAR_DIGITS)}`;
  }
  if (digits.length > YEAR_DIGITS) {
    out += `-${digits.slice(YEAR_DIGITS)}`;
  }
  if (cleaned.endsWith('-') && (digits.length === 0 || digits.length === YEAR_DIGITS)) {
    out += '-';
  }
  return out;
};

export const isEnrollmentIdShaped = (value: string): boolean =>
  CANONICAL.test(normalizeEnrollmentId(value));
