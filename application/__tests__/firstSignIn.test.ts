import { resolveErrorCode } from '../src/utils/resolveError';
import {
  isAccountInactiveError,
  isEmailNotVerifiedError,
  isPasswordChangeRequiredError,
  revocationForError,
} from '../src/utils/sessionGuards';
import { passwordFlowCopy } from '../src/screens/auth/passwordFlowCopy';
import { isPublicPath } from '../src/config/endpoints';
import { isStrongPassword } from '../src/utils/validators';

const apiError = (
  status: number,
  message: string,
  code?: string,
  url = '/auth/login',
) => ({
  isAxiosError: true,
  message: 'Request failed',
  config: { url },
  response: {
    status,
    data: { success: false, message, ...(code ? { code } : {}) },
  },
});

const TEMP_PASSWORD_MESSAGE =
  'This is a temporary password. Set your own password to continue.';

describe('temporary password refusal', () => {
  it('matches on the code and keeps the other 403 flows out of it', () => {
    const error = apiError(403, TEMP_PASSWORD_MESSAGE, 'PASSWORD_CHANGE_REQUIRED');

    expect(isPasswordChangeRequiredError(error)).toBe(true);
    expect(isEmailNotVerifiedError(error)).toBe(false);
    expect(isAccountInactiveError(error)).toBe(false);
    expect(revocationForError(error)).toBeNull();
    expect(resolveErrorCode(error)).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('does not claim the deactivated or unverified 403s', () => {
    const inactive = apiError(403, 'Your account is inactive.', 'ACCOUNT_INACTIVE');
    const unverified = apiError(403, 'Your email is not verified yet.', 'EMAIL_NOT_VERIFIED');

    expect(isPasswordChangeRequiredError(inactive)).toBe(false);
    expect(isPasswordChangeRequiredError(unverified)).toBe(false);
    expect(isAccountInactiveError(inactive)).toBe(true);
    expect(isEmailNotVerifiedError(unverified)).toBe(true);
  });

  it('leaves a wrong password as a plain 401', () => {
    const error = apiError(401, 'Invalid email or password');

    expect(isPasswordChangeRequiredError(error)).toBe(false);
    expect(revocationForError(error)).toBeNull();
    expect(resolveErrorCode(error)).toBe('SESSION_EXPIRED');
  });

  it('refuses the code sign-in route the same way', () => {
    const error = apiError(
      403,
      TEMP_PASSWORD_MESSAGE,
      'PASSWORD_CHANGE_REQUIRED',
      '/auth/verify-otp',
    );

    expect(isPasswordChangeRequiredError(error)).toBe(true);
    expect(resolveErrorCode(error)).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('keeps every step of the flow on a token-free public path', () => {
    expect(isPublicPath('/auth/forgot-password')).toBe(true);
    expect(isPublicPath('/auth/verify-reset-code')).toBe(true);
    expect(isPublicPath('/auth/reset-password')).toBe(true);
    expect(isPublicPath('/auth/login')).toBe(true);
  });
});

describe('password flow copy', () => {
  it('reads as setup for a first sign in and as recovery otherwise', () => {
    const setup = passwordFlowCopy('setup');
    const reset = passwordFlowCopy('reset');

    expect(setup.notice).toBeDefined();
    expect(reset.notice).toBeUndefined();
    expect(setup.request.title).not.toBe(reset.request.title);
    expect(setup.password.title).not.toBe(reset.password.title);
  });
});

describe('password rule shown while typing', () => {
  it('matches the eight characters with a letter and a number the server wants', () => {
    expect(isStrongPassword('TheirOwn1Pass')).toBe(true);
    expect(isStrongPassword('short1')).toBe(false);
    expect(isStrongPassword('alllettersonly')).toBe(false);
    expect(isStrongPassword('12345678')).toBe(false);
  });
});
