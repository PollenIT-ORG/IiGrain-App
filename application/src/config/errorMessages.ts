import { ICONS } from '../components/AppIcon/iconRegistry';

export type ErrorSeverity = 'error' | 'warning' | 'validation' | 'info' | 'success';

export interface ErrorPresentation {
  readonly code: string;
  readonly title: string;
  readonly message: string;
  readonly icon: string;
  readonly severity: ErrorSeverity;
  readonly buttonText: string;
}

type ErrorEntry = Omit<Partial<ErrorPresentation>, 'code'> & {
  readonly title: string;
  readonly message: string;
  readonly preferServerMessage?: boolean;
};

export const UNKNOWN_ERROR_CODE = 'UNKNOWN';

export const GENERIC_ERROR_MESSAGE = 'Please try again in a few moments.';

export const ERROR_MESSAGES: Record<string, ErrorEntry> = {
  UNKNOWN: {
    title: 'Something went wrong',
    message: GENERIC_ERROR_MESSAGE,
    icon: ICONS.ERROR,
    severity: 'error',
    buttonText: 'OK',
  },

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
  INVALID_CODE: {
    title: 'Incorrect Code',
    message:
      'The code you entered is incorrect or has expired. Please re-enter it or request a new one.',
    icon: ICONS.LOCK,
    severity: 'validation',
    buttonText: 'Got it',
  },

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

  ALREADY_REGISTERED: {
    title: 'You already have an account',
    message: 'You are already registered. Please log in instead.',
    icon: ICONS.USER_CIRCLE,
    severity: 'info',
    buttonText: 'Log in',
    preferServerMessage: true,
  },
  ENROLLMENT_ID_REQUIRED: {
    title: 'Enrollment ID needed',
    message: 'Enter the Enrollment ID from your email to create your account.',
    icon: ICONS.ID_CARD,
    severity: 'validation',
    buttonText: 'Got it',
    preferServerMessage: true,
  },
  ENROLLMENT_ID_NOT_FOUND: {
    title: "We couldn't find that ID",
    message: 'That Enrollment ID was not found. Please check the ID in your email.',
    icon: ICONS.ID_CARD,
    severity: 'validation',
    buttonText: 'Check ID',
    preferServerMessage: true,
  },
  ENROLLMENT_ID_EMAIL_MISMATCH: {
    title: 'ID issued to another email',
    message:
      'That Enrollment ID belongs to a different email address. Register with the address the ID was sent to.',
    icon: ICONS.EMAIL,
    severity: 'validation',
    buttonText: 'Check details',
    preferServerMessage: true,
  },
  SURVEY_REQUIRED: {
    title: 'Survey needed first',
    message:
      "Please complete this program's survey first. You can enroll once your Enrollment ID for it has been issued.",
    icon: ICONS.SURVEY,
    severity: 'info',
    buttonText: 'Got it',
    preferServerMessage: true,
  },
  CONFLICT: {
    title: 'Already Exists',
    message: 'A record with these details already exists.',
    icon: ICONS.WARNING,
    severity: 'warning',
    buttonText: 'Got it',
    preferServerMessage: true,
  },

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
    preferServerMessage: true,
  },
};

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
  readonly resolveTo: string;
  readonly code?: string;
  readonly status?: number;
  readonly message?: RegExp;
  readonly url?: RegExp;
  readonly offline?: boolean;
  readonly timeout?: boolean;
}

export const ERROR_RULES: readonly ErrorRule[] = [
  { resolveTo: 'TIMEOUT', timeout: true },
  { resolveTo: 'NETWORK_ERROR', offline: true },

  { resolveTo: 'ACCOUNT_DEACTIVATED', status: 403, message: /deactivat/i },
  { resolveTo: 'ACCOUNT_UNAVAILABLE', status: 401, message: /no longer available/i },

  { resolveTo: 'FIELD_AREA_EXCEEDED', message: /field area is too large|exceed .*farm area/i },
  { resolveTo: 'INVALID_LOCATION', message: /valid location|location is required|invalid coordinates/i },
  { resolveTo: 'ASSESSMENT_ALREADY_SUBMITTED', message: /already been submitted/i },
  { resolveTo: 'ENTITY_IN_USE', message: /enrolled in a program|cannot be deleted/i },
  { resolveTo: 'ACCOUNT_ALREADY_EXISTS', message: /account with this email already exists/i },

  { resolveTo: 'ENROLLMENT_ID_EMAIL_MISMATCH', message: /enrollment id belongs to a different email|belongs to a different email address/i },
  { resolveTo: 'ENROLLMENT_ID_NOT_FOUND', message: /enrollment id was not found|check the id in your email/i },
  { resolveTo: 'ENROLLMENT_ID_REQUIRED', message: /enrollment id is required/i },
  { resolveTo: 'ALREADY_REGISTERED', message: /already registered/i },
  { resolveTo: 'SURVEY_REQUIRED', message: /complete this program.s survey|enrollment id for it has been issued/i },
  { resolveTo: 'INVALID_CODE', message: /invalid or expired code|incorrect code|invalid code|code (is )?(incorrect|invalid|expired)/i },
  { resolveTo: 'INVALID_CODE', status: 401, url: /verify-reset-code|verify-otp/i },
  { resolveTo: 'FIELD_ALREADY_EXISTS', status: 409, url: /\/fields(\/|$|\?)/i },
  { resolveTo: 'FARM_ALREADY_EXISTS', status: 409, url: /\/farms(\/|$|\?)/i },
  { resolveTo: 'FILE_TOO_LARGE', message: /file (is )?too large|payload too large/i },
  { resolveTo: 'UNSUPPORTED_TYPE', message: /file type is not supported|unsupported (file|media) type/i },
  { resolveTo: 'UPLOAD_FAILED', status: 413 },

  { resolveTo: 'SESSION_EXPIRED', code: 'UNAUTHORIZED' },
  { resolveTo: 'FORBIDDEN', code: 'FORBIDDEN' },
  { resolveTo: 'NOT_FOUND', code: 'NOT_FOUND' },
  { resolveTo: 'CONFLICT', code: 'CONFLICT' },
  { resolveTo: 'VALIDATION_ERROR', code: 'VALIDATION_ERROR' },
  { resolveTo: 'VALIDATION_ERROR', code: 'UNPROCESSABLE_ENTITY' },
  { resolveTo: 'BAD_REQUEST', code: 'BAD_REQUEST' },
  { resolveTo: 'TOO_MANY_REQUESTS', code: 'TOO_MANY_REQUESTS' },
  { resolveTo: 'SERVER_ERROR', code: 'INTERNAL_SERVER_ERROR' },

  { resolveTo: 'SESSION_EXPIRED', status: 401 },
  { resolveTo: 'FORBIDDEN', status: 403 },
  { resolveTo: 'NOT_FOUND', status: 404 },
  { resolveTo: 'CONFLICT', status: 409 },
  { resolveTo: 'VALIDATION_ERROR', status: 422 },
  { resolveTo: 'BAD_REQUEST', status: 400 },
  { resolveTo: 'TOO_MANY_REQUESTS', status: 429 },
];
