import { toErrorContext } from './resolveError';

export type AccountRevocation = 'deactivated' | 'unavailable';

export const ACCOUNT_INACTIVE_CODE = 'ACCOUNT_INACTIVE';
export const EMAIL_NOT_VERIFIED_CODE = 'EMAIL_NOT_VERIFIED';
export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';

const DEACTIVATED = /deactivat|account is inactive/i;
const UNAVAILABLE = /no longer available|account (has been )?(deleted|removed)/i;

export const accountRevocationFor = (
  status: number | null,
  message: string | null | undefined,
  code?: string | null,
): AccountRevocation | null => {
  if (code === ACCOUNT_INACTIVE_CODE) {
    return 'deactivated';
  }
  if (code === EMAIL_NOT_VERIFIED_CODE || code === PASSWORD_CHANGE_REQUIRED_CODE) {
    return null;
  }
  const text = message ?? '';
  if (status === 403 && DEACTIVATED.test(text)) {
    return 'deactivated';
  }
  if (status === 401 && UNAVAILABLE.test(text)) {
    return 'unavailable';
  }
  return null;
};

export const revocationForError = (error: unknown): AccountRevocation | null => {
  const ctx = toErrorContext(error);
  return accountRevocationFor(ctx.status, ctx.message, ctx.code);
};

export const isAccountInactiveError = (error: unknown): boolean =>
  revocationForError(error) === 'deactivated';

export const isPasswordChangeRequiredError = (error: unknown): boolean =>
  toErrorContext(error).code === PASSWORD_CHANGE_REQUIRED_CODE;

export const isEmailNotVerifiedError = (error: unknown): boolean => {
  const ctx = toErrorContext(error);
  if (ctx.code === PASSWORD_CHANGE_REQUIRED_CODE) {
    return false;
  }
  if (ctx.code === EMAIL_NOT_VERIFIED_CODE) {
    return true;
  }
  if (accountRevocationFor(ctx.status, ctx.message, ctx.code)) {
    return false;
  }
  if (ctx.status === 403) {
    return true;
  }
  return /verif/i.test(ctx.message ?? '');
};
