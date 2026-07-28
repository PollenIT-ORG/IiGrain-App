/**
 * Detects a session the server has revoked out from under us.
 *
 * The backend re-checks the account on every authenticated request, so an admin
 * deactivating or deleting a user invalidates their token immediately instead of
 * waiting for it to expire:
 *
 *   deactivated -> 403 { code: "FORBIDDEN",    message: "Your account has been deactivated. Contact an administrator." }
 *   deleted     -> 401 { code: "UNAUTHORIZED", message: "Your account is no longer available. Please sign in again." }
 *
 * Both codes are generic, so the message is the only discriminator. Refreshing
 * the token cannot fix either one, which is why http.ts skips the refresh and
 * tears the session down instead.
 *
 * Kept as a pure (status, message) function so both the axios interceptor and
 * the login screen can use it without an axios error in hand.
 */
export type AccountRevocation = 'deactivated' | 'unavailable';

const DEACTIVATED = /deactivat/i;
const UNAVAILABLE = /no longer available|account (has been )?(deleted|removed)/i;

export const accountRevocationFor = (
  status: number | null,
  message: string | null | undefined,
): AccountRevocation | null => {
  const text = message ?? '';
  if (status === 403 && DEACTIVATED.test(text)) {
    return 'deactivated';
  }
  if (status === 401 && UNAVAILABLE.test(text)) {
    return 'unavailable';
  }
  return null;
};
