import { isAxiosError } from 'axios';
import {
  ERROR_MESSAGES,
  ERROR_RULES,
  GENERIC_BACKEND_CODES,
  UNKNOWN_ERROR_CODE,
  type ErrorPresentation,
  type ErrorRule,
} from '../config/errorMessages';
import { getApiMessage } from './getApiMessage';

export interface ErrorContext {
  readonly code: string | null;
  readonly status: number | null;
  readonly message: string | null;
  readonly url: string | null;
  readonly offline: boolean;
  readonly timeout: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readCode = (body: unknown): string | null => {
  if (!isRecord(body)) {
    return null;
  }
  for (const key of ['code', 'error', 'type'] as const) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  if (isRecord(body.data)) {
    return readCode(body.data);
  }
  return null;
};

export const toErrorContext = (error: unknown): ErrorContext => {
  if (isAxiosError(error)) {
    const response = error.response;
    return {
      code: readCode(response?.data),
      status: response?.status ?? null,
      message: getApiMessage(error, ''),
      url: error.config?.url ?? null,
      offline: !response,
      timeout: error.code === 'ECONNABORTED' || /timeout/i.test(error.message ?? ''),
    };
  }

  return {
    code: isRecord(error) ? readCode(error) : null,
    status: null,
    message: getApiMessage(error, ''),
    url: null,
    offline: false,
    timeout: false,
  };
};

const matches = (rule: ErrorRule, ctx: ErrorContext): boolean => {
  if (rule.timeout !== undefined && rule.timeout !== ctx.timeout) {
    return false;
  }
  if (rule.offline !== undefined && rule.offline !== ctx.offline) {
    return false;
  }
  if (ctx.offline && (rule.code || rule.status || rule.message || rule.url)) {
    return false;
  }
  if (rule.code !== undefined && rule.code !== ctx.code) {
    return false;
  }
  if (rule.status !== undefined && rule.status !== ctx.status) {
    return false;
  }
  if (rule.message !== undefined && !(ctx.message && rule.message.test(ctx.message))) {
    return false;
  }
  if (rule.url !== undefined && !(ctx.url && rule.url.test(ctx.url))) {
    return false;
  }
  return true;
};

export const presentationFor = (
  code: string,
  serverMessage?: string | null,
): ErrorPresentation => {
  const fallback = ERROR_MESSAGES[UNKNOWN_ERROR_CODE];
  const entry = ERROR_MESSAGES[code] ?? fallback;
  const trimmed = serverMessage?.trim();
  return {
    code: ERROR_MESSAGES[code] ? code : UNKNOWN_ERROR_CODE,
    title: entry.title,
    message: entry.preferServerMessage && trimmed ? trimmed : entry.message,
    icon: entry.icon ?? fallback.icon ?? '',
    severity: entry.severity ?? fallback.severity ?? 'error',
    buttonText: entry.buttonText ?? fallback.buttonText ?? 'OK',
  };
};

const codeForContext = (ctx: ErrorContext): string => {
  if (ctx.code && ERROR_MESSAGES[ctx.code] && !GENERIC_BACKEND_CODES.has(ctx.code)) {
    return ctx.code;
  }
  return ERROR_RULES.find(r => matches(r, ctx))?.resolveTo ?? UNKNOWN_ERROR_CODE;
};

export const resolveErrorCode = (error: unknown): string =>
  codeForContext(toErrorContext(error));

export const resolveError = (error: unknown): ErrorPresentation => {
  const ctx = toErrorContext(error);
  return presentationFor(codeForContext(ctx), ctx.message);
};
