// Imported from the registry directly rather than the AppIcon barrel: this
// config is pulled in by services/http, and the barrel would drag the React
// component into that import chain.
import { ICONS } from '../components/AppIcon/iconRegistry';

/**
 * The single place every user-facing error string lives.
 *
 * Adding a new error means adding one entry to ERROR_MESSAGES and, if the
 * backend cannot be told to send its code, one rule to ERROR_RULES. No screen,
 * thunk or service needs to change.
 */

export type ErrorSeverity = 'error' | 'warning' | 'validation' | 'info' | 'success';

export interface ErrorPresentation {
  readonly code: string;
  readonly title: string;
  readonly message: string;
  readonly icon: string;
  readonly severity: ErrorSeverity;
  readonly buttonText: string;
}

/** An entry may omit anything that should fall back to the UNKNOWN entry. */
type ErrorEntry = Omit<Partial<ErrorPresentation>, 'code'> & {
  readonly title: string;
  readonly message: string;
  /**
   * Prefer the backend's own message over `message` when it sent one.
   *
   * Set this where the server knows a detail the catalogue cannot — "Only 3
   * acre(s) can be added" beats a generic sentence. `title`, `icon`, `severity`
   * and `buttonText` still come from this entry, so the framing stays ours and
   * only the detail line is the server's. Leave it off for anything where the
   * raw server text would be noise or leak internals.
   */
  readonly preferServerMessage?: boolean;
};

export const UNKNOWN_ERROR_CODE = 'UNKNOWN';

/**
 * Copy for an unidentified failure. Screens that render an inline error string
 * fall back to this instead of hardcoding one of their own.
 */
export const GENERIC_ERROR_MESSAGE = 'Please try again in a few moments.';

export const ERROR_MESSAGES: Record<string, ErrorEntry> = {
  // ── Fallback. Every unmapped failure lands here. ──
  UNKNOWN: {
    title: 'Something went wrong',
    message: GENERIC_ERROR_MESSAGE,
    icon: ICONS.ERROR,
    severity: 'error',
    buttonText: 'OK',
  },

  // ── Connectivity / session ──
  NETWORK_ERROR: {
    title: 'Connection Problem',
    message: 'Please check your internet connection and try again.',
    icon: ICONS.OFFLINE,
    severity: 'error',
    buttonText: 'Retry',
  },
  TIMEOUT: {
    title: 'Taking Too Long',
    message: 'The server is slow to respond. Please try again.',
    icon: ICONS.CLOCK,
    severity: 'warning',
    buttonText: 'Retry',
  },
  SESSION_EXPIRED: {
    title: 'Session Expired',
    message: 'Please sign in again to continue.',
    icon: ICONS.LOCK,
    severity: 'warning',
    buttonText: 'Sign in',
  },
  UNAUTHORIZED: {
    title: 'Sign In Required',
    message: 'Please sign in to continue.',
    icon: ICONS.LOCK,
    severity: 'warning',
    buttonText: 'OK',
  },
  FORBIDDEN: {
    title: 'Not Allowed',
    message: 'You do not have permission to do this.',
    icon: ICONS.LOCK,
    severity: 'warning',
    buttonText: 'Got it',
  },
  /**
   * The backend re-checks the account on EVERY authenticated request, so an
   * admin deactivating/deleting a user kills their token mid-session. Both
   * arrive under a generic code (FORBIDDEN / UNAUTHORIZED) and are told apart
   * by message — see ERROR_RULES. The server wording is the useful one here
   * ("Contact an administrator"), so both prefer it.
   */
  ACCOUNT_DEACTIVATED: {
    title: 'Account Deactivated',
    message: 'Your account has been deactivated. Contact an administrator.',
    icon: ICONS.LOCK,
    severity: 'error',
    buttonText: 'Sign in',
    preferServerMessage: true,
  },
  ACCOUNT_UNAVAILABLE: {
    title: 'Account Unavailable',
    message: 'Your account is no longer available. Please sign in again.',
    icon: ICONS.LOCK,
    severity: 'error',
    buttonText: 'Sign in',
    preferServerMessage: true,
  },
  TOO_MANY_REQUESTS: {
    title: 'Slow Down',
    message: 'Too many attempts. Please wait a moment and try again.',
    icon: ICONS.CLOCK,
    severity: 'warning',
    buttonText: 'Got it',
  },

  // ── Server ──
  SERVER_ERROR: {
    title: 'Server Problem',
    message: "This is on our side. Please try again in a few moments.",
    icon: ICONS.ERROR,
    severity: 'error',
    buttonText: 'OK',
  },
  NOT_FOUND: {
    title: 'Not Found',
    message: 'We could not find what you were looking for.',
    icon: ICONS.SEARCH,
    severity: 'info',
    buttonText: 'OK',
  },

  // ── Validation ──
  VALIDATION_ERROR: {
    title: 'Check Your Details',
    message: 'Some information needs fixing before you can continue.',
    icon: ICONS.WARNING,
    severity: 'validation',
    buttonText: 'Got it',
    preferServerMessage: true,
  },
  BAD_REQUEST: {
    title: 'Check Your Details',
    message: 'Some information looks incorrect. Please review and try again.',
    icon: ICONS.WARNING,
    severity: 'validation',
    buttonText: 'Got it',
    preferServerMessage: true,
  },
  INVALID_LOCATION: {
    title: 'Location Required',
    message: 'Please select a valid location.',
    icon: ICONS.MAP_MARKER,
    severity: 'validation',
    buttonText: 'Got it',
  },

  // ── Farm / field domain ──
  FIELD_AREA_EXCEEDED: {
    title: 'Field Area Limit Exceeded',
    message: 'The entered field area exceeds the remaining available farm area.',
    icon: ICONS.AREA,
    severity: 'warning',
    buttonText: 'Got it',
    preferServerMessage: true,
  },
  FIELD_ALREADY_EXISTS: {
    title: 'Field Already Exists',
    message: 'Please choose a different field name.',
    icon: ICONS.FIELD,
    severity: 'warning',
    buttonText: 'Got it',
  },
  FARM_ALREADY_EXISTS: {
    title: 'Farm Already Exists',
    message: 'Please choose a different farm name.',
    icon: ICONS.FARM,
    severity: 'warning',
    buttonText: 'Got it',
  },
  ACCOUNT_ALREADY_EXISTS: {
    title: 'Account Already Exists',
    message: 'An account with these details already exists. Try signing in instead.',
    icon: ICONS.USER,
    severity: 'warning',
    buttonText: 'Got it',
  },
  CONFLICT: {
    title: 'Already Exists',
    message: 'A record with these details already exists.',
    icon: ICONS.WARNING,
    severity: 'warning',
    buttonText: 'Got it',
    preferServerMessage: true,
  },

  // ── Assessment domain ──
  ASSESSMENT_ALREADY_SUBMITTED: {
    title: 'Already Submitted',
    message: 'This assessment has already been submitted and can no longer be changed.',
    icon: ICONS.REVIEW,
    severity: 'info',
    buttonText: 'Got it',
    preferServerMessage: true,
  },
  ENTITY_IN_USE: {
    title: 'Cannot Delete',
    message:
      'This item is being used elsewhere. Remove it from its program or assessment first.',
    icon: ICONS.WARNING,
    severity: 'warning',
    buttonText: 'Got it',
    preferServerMessage: true,
  },

  // ── Uploads ──
  UPLOAD_FAILED: {
    title: 'Upload Failed',
    message: "We couldn't upload your data. Please try again.",
    icon: ICONS.UPLOAD,
    severity: 'error',
    buttonText: 'Retry',
  },
  FILE_TOO_LARGE: {
    title: 'File Too Large',
    message: 'Please choose a smaller file and try again.',
    icon: ICONS.UPLOAD,
    severity: 'validation',
    buttonText: 'Got it',
  },
  UNSUPPORTED_TYPE: {
    title: 'Unsupported File',
    message: 'This file type is not supported. Please choose another file.',
    icon: ICONS.DOCUMENT,
    severity: 'validation',
    buttonText: 'Got it',
  },
  DOWNLOAD_FAILED: {
    title: 'Download Failed',
    message: "We couldn't download this file. Please try again.",
    icon: ICONS.DOWNLOAD,
    severity: 'error',
    buttonText: 'Retry',
  },
  PERMISSION_BLOCKED: {
    title: 'Permission Needed',
    message: 'Please allow access in your device settings to continue.',
    icon: ICONS.LOCK,
    severity: 'warning',
    buttonText: 'Got it',
  },
  PERMISSION_DENIED: {
    title: 'Permission Needed',
    message: 'Permission is required to continue.',
    icon: ICONS.LOCK,
    severity: 'warning',
    buttonText: 'Got it',
  },
  INVALID_URI: {
    title: 'File Unreadable',
    message: 'The selected file could not be read. Please choose another one.',
    icon: ICONS.DOCUMENT,
    severity: 'validation',
    buttonText: 'Got it',
  },
  LIMIT_EXCEEDED: {
    title: 'Too Many Files',
    message: 'You have selected more files than allowed.',
    icon: ICONS.IMAGE_MULTIPLE,
    severity: 'validation',
    buttonText: 'Got it',
    // The picker knows the actual limit; the catalogue only knows there is one.
    preferServerMessage: true,
  },
};

/**
 * How a backend response becomes one of the codes above.
 *
 * Rules are evaluated top to bottom and the first match wins, so put the most
 * specific rules first. A rule matches only if every field it declares matches.
 *
 * `code` matches the `code` field the backend sends in its error body. The
 * backend currently emits generic codes only (BAD_REQUEST, CONFLICT, …), so
 * domain errors are narrowed further by `message` and `url` — that is why the
 * order below matters.
 */
/**
 * Codes the backend sends for a whole status class rather than one situation.
 *
 * These must never short-circuit rule matching: when the backend replies
 * `CONFLICT`, the actual error (duplicate field vs. enrolled-in-a-program) is
 * only knowable from the message and URL. A code outside this set is specific
 * enough to trust on its own, which is how a future backend can add
 * `FIELD_AREA_EXCEEDED` and have it work with no rule at all.
 */
export const GENERIC_BACKEND_CODES: ReadonlySet<string> = new Set([
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'TOO_MANY_REQUESTS',
  'INTERNAL_SERVER_ERROR',
  'ERROR',
]);

export interface ErrorRule {
  /** Code to resolve to when this rule matches. */
  readonly resolveTo: string;
  /** Matches the backend body's `code` field, case-sensitive. */
  readonly code?: string;
  /** Matches the HTTP status. */
  readonly status?: number;
  /** Matches the backend's human message. */
  readonly message?: RegExp;
  /** Matches the request path, for narrowing a generic code to a domain. */
  readonly url?: RegExp;
  /** Matches when the request never reached the server. */
  readonly offline?: boolean;
  /** Matches an axios timeout. */
  readonly timeout?: boolean;
}

export const ERROR_RULES: readonly ErrorRule[] = [
  // ── Transport, before anything status-based ──
  { resolveTo: 'TIMEOUT', timeout: true },
  { resolveTo: 'NETWORK_ERROR', offline: true },

  // ── Session revocation, before every other status rule ──
  // The backend sends these under generic codes, so only the message tells them
  // apart. They must win over the plain FORBIDDEN/SESSION_EXPIRED rules below,
  // because http.ts tears the session down for exactly these two.
  { resolveTo: 'ACCOUNT_DEACTIVATED', status: 403, message: /deactivat/i },
  { resolveTo: 'ACCOUNT_UNAVAILABLE', status: 401, message: /no longer available/i },

  // ── Domain errors carried inside generic backend codes ──
  // "Field area is too large. Only N acre(s) can be added." — field.service.ts
  { resolveTo: 'FIELD_AREA_EXCEEDED', message: /field area is too large|exceed .*farm area/i },
  { resolveTo: 'INVALID_LOCATION', message: /valid location|location is required|invalid coordinates/i },
  { resolveTo: 'ASSESSMENT_ALREADY_SUBMITTED', message: /already been submitted/i },
  { resolveTo: 'ENTITY_IN_USE', message: /enrolled in a program|cannot be deleted/i },
  { resolveTo: 'ACCOUNT_ALREADY_EXISTS', message: /account with this email already exists/i },
  { resolveTo: 'FIELD_ALREADY_EXISTS', status: 409, url: /\/fields(\/|$|\?)/i },
  { resolveTo: 'FARM_ALREADY_EXISTS', status: 409, url: /\/farms(\/|$|\?)/i },
  { resolveTo: 'FILE_TOO_LARGE', message: /file (is )?too large|payload too large/i },
  { resolveTo: 'UNSUPPORTED_TYPE', message: /file type is not supported|unsupported (file|media) type/i },
  { resolveTo: 'UPLOAD_FAILED', status: 413 },

  // ── Generic backend codes ──
  { resolveTo: 'SESSION_EXPIRED', code: 'UNAUTHORIZED' },
  { resolveTo: 'FORBIDDEN', code: 'FORBIDDEN' },
  { resolveTo: 'NOT_FOUND', code: 'NOT_FOUND' },
  { resolveTo: 'CONFLICT', code: 'CONFLICT' },
  { resolveTo: 'VALIDATION_ERROR', code: 'VALIDATION_ERROR' },
  { resolveTo: 'VALIDATION_ERROR', code: 'UNPROCESSABLE_ENTITY' },
  { resolveTo: 'BAD_REQUEST', code: 'BAD_REQUEST' },
  { resolveTo: 'TOO_MANY_REQUESTS', code: 'TOO_MANY_REQUESTS' },
  { resolveTo: 'SERVER_ERROR', code: 'INTERNAL_SERVER_ERROR' },

  // ── Status-only fallbacks, for any response without a usable code ──
  { resolveTo: 'SESSION_EXPIRED', status: 401 },
  { resolveTo: 'FORBIDDEN', status: 403 },
  { resolveTo: 'NOT_FOUND', status: 404 },
  { resolveTo: 'CONFLICT', status: 409 },
  { resolveTo: 'VALIDATION_ERROR', status: 422 },
  { resolveTo: 'BAD_REQUEST', status: 400 },
  { resolveTo: 'TOO_MANY_REQUESTS', status: 429 },
];
