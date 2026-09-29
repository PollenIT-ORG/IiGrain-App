import { useEffect, useRef, useState } from 'react';
import { lookupEnrollmentId, type EnrollmentIdLookup } from '../../../api/authApi';
import { useDebouncedValue } from '../../../hooks';
import { handleApiError } from '../../../utils/handleApiError';
import { isEnrollmentIdShaped, normalizeEnrollmentId } from '../../../utils/enrollmentId';

const LOOKUP_DEBOUNCE_MS = 600;

const NOT_FOUND =
  'That Enrollment ID was not found. Please check the ID in your email.';

const MALFORMED = 'Check the Enrollment ID from your email.';

const RATE_LIMITED =
  'Too many checks. Please wait a minute and try again. You can still continue and enter your details yourself.';

const UNAVAILABLE =
  'We could not check that Enrollment ID. You can still continue and enter your details yourself.';

export type EnrollmentIdLookupFailure = 'notFound' | 'unavailable';

export interface EnrollmentIdLookupState {
  checking: boolean;
  result: EnrollmentIdLookup | null;
  error: string | null;
  kind: EnrollmentIdLookupFailure | null;
}

const IDLE: EnrollmentIdLookupState = {
  checking: false,
  result: null,
  error: null,
  kind: null,
};

export const enrollmentLookupFailure = (
  status: number | null,
  serverMessage?: string,
): { message: string; kind: EnrollmentIdLookupFailure } => {
  if (status === 400) {
    return { message: MALFORMED, kind: 'notFound' };
  }
  if (status === 404) {
    return { message: serverMessage?.trim() || NOT_FOUND, kind: 'notFound' };
  }
  if (status === 429) {
    return { message: RATE_LIMITED, kind: 'unavailable' };
  }
  return { message: UNAVAILABLE, kind: 'unavailable' };
};

const failureFor = (
  error: unknown,
): { message: string; kind: EnrollmentIdLookupFailure } => {
  const { status, message } = handleApiError(error);
  return enrollmentLookupFailure(status, message);
};

export const useEnrollmentIdLookup = (
  enrollmentId: string,
): EnrollmentIdLookupState => {
  const [state, setState] = useState<EnrollmentIdLookupState>(IDLE);

  const normalized = normalizeEnrollmentId(enrollmentId);
  const shaped = isEnrollmentIdShaped(normalized);
  const debounced = useDebouncedValue(shaped ? normalized : '', LOOKUP_DEBOUNCE_MS);

  const cache = useRef(new Map<string, EnrollmentIdLookup>());

  useEffect(() => {
    if (!debounced) {
      setState(IDLE);
      return;
    }

    const cached = cache.current.get(debounced);
    if (cached) {
      setState({ checking: false, result: cached, error: null, kind: null });
      return;
    }

    let alive = true;
    setState({ checking: true, result: null, error: null, kind: null });

    lookupEnrollmentId(debounced)
      .then(result => {
        if (!alive) {
          return;
        }
        cache.current.set(debounced, result);
        setState({ checking: false, result, error: null, kind: null });
      })
      .catch(error => {
        if (!alive) {
          return;
        }
        const { message, kind } = failureFor(error);
        setState({ checking: false, result: null, error: message, kind });
      });

    return () => {
      alive = false;
    };
  }, [debounced]);

  const settled = shaped && debounced === normalized;
  return settled ? state : IDLE;
};
