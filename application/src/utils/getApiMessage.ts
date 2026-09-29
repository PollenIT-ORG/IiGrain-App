import { GENERIC_ERROR_MESSAGE } from '../config/errorMessages';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const MESSAGE_KEYS = ['message', 'msg', 'detail', 'description', 'reason', 'error'];

const IDENTIFIER_KEYS = new Set([
  'field',
  'param',
  'path',
  'location',
  'code',
  'key',
  'type',
  'name',
  'id',
  'value',
  'index',
  'instancePath',
  'schemaPath',
  'keyword',
]);

const firstString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  if (isRecord(value)) {
    for (const key of MESSAGE_KEYS) {
      if (key in value) {
        const found = firstString(value[key]);
        if (found) {
          return found;
        }
      }
    }
    for (const key of Object.keys(value)) {
      if (MESSAGE_KEYS.includes(key)) {
        continue;
      }
      if (IDENTIFIER_KEYS.has(key) && typeof value[key] === 'string') {
        continue;
      }
      const found = firstString(value[key]);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
};

const fromResponseBody = (body: unknown): string | undefined => {
  if (!isRecord(body)) {
    return firstString(body);
  }
  const direct =
    firstString(body.message) ??
    firstString(body.error) ??
    firstString(body.detail);
  if (direct) {
    return direct;
  }
  if ('errors' in body) {
    const fromErrors = firstString(body.errors);
    if (fromErrors) {
      return fromErrors;
    }
  }
  if ('data' in body) {
    const fromData = fromResponseBody(body.data);
    if (fromData) {
      return fromData;
    }
  }
  return undefined;
};

export const getApiMessage = (
  error: unknown,
  fallback: string = GENERIC_ERROR_MESSAGE,
): string => {
  if (!isRecord(error)) {
    return typeof error === 'string' && error.trim() ? error.trim() : fallback;
  }

  const response = error.response;
  if (isRecord(response)) {
    const fromBody = fromResponseBody(response.data);
    if (fromBody) {
      return fromBody;
    }
  }

  const axiosMessage = firstString(error.message);
  if (axiosMessage) {
    return axiosMessage;
  }

  return fallback;
};
