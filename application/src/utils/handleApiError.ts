import { isAxiosError } from 'axios';
import { getApiMessage } from './getApiMessage';

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
  if (isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const hasResponse = Boolean(error.response);
    return {
      message: getApiMessage(error),
      status,
      kind: classify(status, hasResponse),
    };
  }
  return {
    message: getApiMessage(error),
    status: null,
    kind: 'unknown',
  };
};
