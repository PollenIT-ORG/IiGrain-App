export interface ShowErrorOptions {
  readonly title?: string;
}

export type ErrorHandler = (message: string, options?: ShowErrorOptions) => void;

let handler: ErrorHandler | null = null;

export const setErrorHandler = (next: ErrorHandler | null): void => {
  handler = next;
};

export const showError = (message: string, options?: ShowErrorOptions): void => {
  if (handler) {
    handler(message, options);
  }
};
