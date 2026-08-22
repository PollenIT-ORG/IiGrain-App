import type { ErrorPresentation } from '../config/errorMessages';
import { presentationFor, resolveError } from '../utils/resolveError';

export type ErrorHandler = (presentation: ErrorPresentation) => void;

let handler: ErrorHandler | null = null;

export const setErrorHandler = (next: ErrorHandler | null): void => {
  handler = next;
};

export const showError = (error: unknown): void => {
  handler?.(resolveError(error));
};

export const showErrorCode = (code: string): void => {
  handler?.(presentationFor(code));
};
