import type { ErrorPresentation } from '../config/errorMessages';
import { presentationFor, resolveError } from '../utils/resolveError';

export type ErrorHandler = (presentation: ErrorPresentation) => void;

let handler: ErrorHandler | null = null;

export const setErrorHandler = (next: ErrorHandler | null): void => {
  handler = next;
};

/**
 * Shows a resolved error. Nothing outside src/config/errorMessages.ts should
 * decide what an error says, so this takes the raw failure and resolves the copy
 * from the catalogue.
 */
export const showError = (error: unknown): void => {
  handler?.(resolveError(error));
};

/**
 * Shows a specific catalogued error, for failures that never went through the
 * API (a picker cancelling, a filesystem write failing). `code` must exist in
 * the catalogue; anything unknown degrades to the UNKNOWN entry.
 */
export const showErrorCode = (code: string): void => {
  handler?.(presentationFor(code));
};
