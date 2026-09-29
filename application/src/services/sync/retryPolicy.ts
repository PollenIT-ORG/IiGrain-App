import { isAxiosError } from 'axios';
import { handleApiError } from '../../utils/handleApiError';
import type { SyncFailure } from './types';

export const MAX_ATTEMPTS = 6;
export const BASE_DELAY_MS = 2_000;
export const BACKOFF_FACTOR = 3;
export const MAX_DELAY_MS = 10 * 60 * 1000;
export const JITTER_RATIO = 0.2;
export const STALE_CLAIM_MS = 5 * 60 * 1000;

const RETRYABLE_STATUSES = new Set([408, 425, 429]);

export const classifyFailure = (error: unknown): SyncFailure => {
  if (isAxiosError(error)) {
    const standardized = handleApiError(error);
    const status = standardized.status;

    if (standardized.kind === 'offline') {
      return { kind: 'offline', message: standardized.message, status };
    }
    if (standardized.kind === 'auth') {
      return { kind: 'auth', message: standardized.message, status };
    }
    if (status !== null && RETRYABLE_STATUSES.has(status)) {
      return { kind: 'retryable', message: standardized.message, status };
    }
    if (status !== null && status >= 500) {
      return { kind: 'retryable', message: standardized.message, status };
    }
    if (status !== null && status >= 400) {
      return { kind: 'permanent', message: standardized.message, status };
    }
    return { kind: 'retryable', message: standardized.message, status };
  }

  const message = error instanceof Error ? error.message : String(error);
  return { kind: 'retryable', message, status: null };
};

export const backoffDelayMs = (
  attemptCount: number,
  random: () => number = Math.random,
): number => {
  const exponent = Math.max(0, attemptCount - 1);
  const raw = BASE_DELAY_MS * Math.pow(BACKOFF_FACTOR, exponent);
  const capped = Math.min(raw, MAX_DELAY_MS);
  const jitter = capped * JITTER_RATIO * (random() * 2 - 1);
  return Math.max(BASE_DELAY_MS, Math.round(capped + jitter));
};

export const nextAvailableAt = (
  attemptCount: number,
  now: number = Date.now(),
  random: () => number = Math.random,
): string => new Date(now + backoffDelayMs(attemptCount, random)).toISOString();

export const hasAttemptsLeft = (attemptCount: number): boolean =>
  attemptCount < MAX_ATTEMPTS;

export const isStaleClaim = (
  claimedAt: string | null,
  now: number = Date.now(),
): boolean => {
  if (!claimedAt) {
    return true;
  }
  const claimedMs = Date.parse(claimedAt);
  if (!Number.isFinite(claimedMs)) {
    return true;
  }
  return now - claimedMs > STALE_CLAIM_MS;
};
