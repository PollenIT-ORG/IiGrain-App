import { resolveErrorCode } from '../src/utils/resolveError';

const apiError = (status: number, message: string, code?: string) => ({
  isAxiosError: true,
  message: 'Request failed',
  config: { url: '/auth/register' },
  response: { status, data: code ? { code, message } : { message } },
});

describe('enrollment error mapping', () => {
  it.each([
    ['Enrollment ID is required.', 400, 'ENROLLMENT_ID_REQUIRED'],
    [
      'That Enrollment ID was not found. Please check the ID in your email.',
      400,
      'ENROLLMENT_ID_NOT_FOUND',
    ],
    [
      'That Enrollment ID belongs to a different email address. Register with the address the ID was sent to.',
      400,
      'ENROLLMENT_ID_EMAIL_MISMATCH',
    ],
    ['You are already registered. Please log in instead.', 409, 'ALREADY_REGISTERED'],
    [
      "Please complete this program's survey first. You can enroll once your Enrollment ID for it has been issued.",
      400,
      'SURVEY_REQUIRED',
    ],
  ])('maps "%s" (HTTP %i) to %s', (message, status, expected) => {
    expect(resolveErrorCode(apiError(status as number, message as string))).toBe(expected);
  });

  it('still maps when the backend also sends a generic code', () => {
    expect(
      resolveErrorCode(
        apiError(400, 'That Enrollment ID was not found.', 'BAD_REQUEST'),
      ),
    ).toBe('ENROLLMENT_ID_NOT_FOUND');
    expect(
      resolveErrorCode(apiError(409, 'You are already registered.', 'CONFLICT')),
    ).toBe('ALREADY_REGISTERED');
  });

  it('falls back to the generic validation code for anything else', () => {
    expect(resolveErrorCode(apiError(400, 'Password is too short.'))).toBe(
      'BAD_REQUEST',
    );
  });
});
