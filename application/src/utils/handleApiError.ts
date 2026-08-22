import { isAxiosError } from 'axios';
import type { ErrorPresentation } from '../config/errorMessages';
import { getApiMessage } from './getApiMessage';
import { resolveError } from './resolveError';

export type ApiErrorKind =
  | 'auth'
  | 'validation'
  | 'notFound'
  | 'rateLimit'
  | 'server'
  | 'offline'
  | 'unknown';

export interface StandardizedError {
  readonly message: string;
  readonly status: number | null;
  readonly kind: ApiErrorKind;
  readonly code: string;
  readonly presentation: ErrorPresentation;
}

const classify = (status: number | null, hasResponse: boolean): ApiErrorKind => {
  if (!hasResponse) {
    return 'offline';
  }
  if (status === 401) {
    return 'auth';
  }
  if (status === 404) {
    return 'notFound';
  }
  if (status === 422 || status === 400) {
    return 'validation';
  }
  if (status === 429) {
    return 'rateLimit';
  }
  if (status !== null && status >= 500) {
    return 'server';
  }
  return 'unknown';
};

export const handleApiError = (error: unknown): StandardizedError => {
  const presentation = resolveError(error);

  if (isAxiosError(error)) {
    const status = error.response?.status ?? null;
    return {
      message: getApiMessage(error, presentation.message),
      status,
      kind: classify(status, Boolean(error.response)),
      code: presentation.code,
      presentation,
    };
  }

  return {
    message: getApiMessage(error, presentation.message),
    status: null,
    kind: 'unknown',
    code: presentation.code,
    presentation,
  };
};
