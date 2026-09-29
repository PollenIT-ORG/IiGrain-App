import { resolveErrorCode } from '../src/utils/resolveError';
import {
  isAccountInactiveError,
  isEmailNotVerifiedError,
  revocationForError,
} from '../src/utils/sessionGuards';
import { contactFieldErrorsFor } from '../src/api/supportApi';
import { isPublicPath } from '../src/config/endpoints';

const apiError = (
  status: number,
  message: string,
  code?: string,
  url = '/auth/login',
  extra?: Record<string, unknown>,
) => ({
  isAxiosError: true,
  message: 'Request failed',
  config: { url },
  response: {
    status,
    data: { message, ...(code ? { code } : {}), ...(extra ?? {}) },
  },
});

const INACTIVE_MESSAGE =
  'Your account is inactive. Please contact an administrator to reactivate it.';
const UNVERIFIED_MESSAGE =
  'Your email is not verified yet. Request a verification code to continue.';

describe('deactivated account detection', () => {
  it('matches on the code, not on the message text', () => {
    const error = apiError(403, INACTIVE_MESSAGE, 'ACCOUNT_INACTIVE');
    expect(revocationForError(error)).toBe('deactivated');
    expect(isAccountInactiveError(error)).toBe(true);
    expect(isEmailNotVerifiedError(error)).toBe(false);
    expect(resolveErrorCode(error)).toBe('ACCOUNT_DEACTIVATED');
  });

  it('keeps the unverified email flow on its own 403', () => {
    const error = apiError(403, UNVERIFIED_MESSAGE, 'EMAIL_NOT_VERIFIED');
    expect(revocationForError(error)).toBeNull();
    expect(isAccountInactiveError(error)).toBe(false);
    expect(isEmailNotVerifiedError(error)).toBe(true);
    expect(resolveErrorCode(error)).toBe('EMAIL_NOT_VERIFIED');
  });

  it('still recognises the older message-only response', () => {
    const error = apiError(403, 'Your account has been deactivated.');
    expect(revocationForError(error)).toBe('deactivated');
    expect(isEmailNotVerifiedError(error)).toBe(false);
  });

  it('treats a 403 with no code as unverified, as before', () => {
    expect(isEmailNotVerifiedError(apiError(403, 'Please verify your email.'))).toBe(
      true,
    );
  });
});

describe('contact enquiry errors', () => {
  it('maps validation entries onto their own fields', () => {
    const error = apiError(400, 'Please fix the highlighted fields.', 'VALIDATION_ERROR', '/contact-enquiries', {
      errors: [
        { field: 'subject', message: 'The subject must be at least 3 characters.' },
        { field: 'nope', message: 'ignored' },
      ],
    });
    expect(contactFieldErrorsFor(error)).toEqual({
      subject: 'The subject must be at least 3 characters.',
    });
  });

  it('returns nothing when the body carries no field errors', () => {
    expect(contactFieldErrorsFor(apiError(500, 'Server error'))).toEqual({});
  });

  it('gives the rate limit its own message', () => {
    expect(
      resolveErrorCode(apiError(429, 'Too many requests', undefined, '/contact-enquiries')),
    ).toBe('CONTACT_RATE_LIMITED');
  });
});

describe('public support endpoints', () => {
  it('does not sign the user out when they fail', () => {
    expect(isPublicPath('/faqs')).toBe(true);
    expect(isPublicPath('/contact-enquiries')).toBe(true);
    expect(isPublicPath('/profile/me')).toBe(false);
  });
});
