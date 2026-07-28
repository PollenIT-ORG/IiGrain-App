export type ConfirmationTone = 'default' | 'danger';

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  /** One or two sentences on what the action does. */
  message: string;
  /** What is destroyed or cleared — rendered as a bulleted list. */
  consequences?: string[];
  /** What survives the action, so the user can weigh the trade. */
  retains?: string[];
  /** Icon name from the central registry. */
  icon?: string;
  /** `danger` recolours the icon and confirm button for irreversible actions. */
  tone?: ConfirmationTone;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Spins the confirm button and locks dismissal while the request is in flight. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
