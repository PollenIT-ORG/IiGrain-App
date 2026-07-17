export type ToastType = 'success' | 'info' | 'error';

export interface ToastOptions {
  readonly type?: ToastType;
  readonly duration?: number;
}

export type ToastHandler = (message: string, options?: ToastOptions) => void;

let handler: ToastHandler | null = null;

export const setToastHandler = (next: ToastHandler | null): void => {
  handler = next;
};

export const showToast = (message: string, options?: ToastOptions): void => {
  handler?.(message, options);
};

export const showSuccess = (message: string): void =>
  showToast(message, { type: 'success' });
