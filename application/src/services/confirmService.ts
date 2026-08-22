import type { ConfirmationTone } from '../components/modals/ConfirmationModal/types';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  icon?: string;
  consequences?: string[];
  acknowledgeOnly?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

export type ConfirmHandler = (request: ConfirmRequest | null) => void;

let handler: ConfirmHandler | null = null;
let pending: ConfirmRequest | null = null;

export const setConfirmHandler = (next: ConfirmHandler | null): void => {
  handler = next;
  if (!next && pending) {
    pending.resolve(false);
    pending = null;
  }
};

export const confirm = (options: ConfirmOptions): Promise<boolean> => {
  if (!handler) {
    return Promise.resolve(false);
  }

  if (pending) {
    pending.resolve(false);
  }

  return new Promise<boolean>(resolve => {
    const request: ConfirmRequest = {
      ...options,
      resolve: confirmed => {
        if (pending === request) {
          pending = null;
          handler?.(null);
        }
        resolve(confirmed);
      },
    };
    pending = request;
    handler?.(request);
  });
};

export const notify = (options: Omit<ConfirmOptions, 'acknowledgeOnly'>): Promise<void> =>
  confirm({ ...options, acknowledgeOnly: true }).then(() => undefined);
