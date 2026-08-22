export type ConfirmationTone = 'default' | 'danger';

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  consequences?: string[];
  retains?: string[];
  icon?: string;
  tone?: ConfirmationTone;
  confirmLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
