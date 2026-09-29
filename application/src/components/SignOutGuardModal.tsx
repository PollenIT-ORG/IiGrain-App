import React from 'react';
import ConfirmationModal from './modals/ConfirmationModal';
import {
  signOutConfirmLabel,
  signOutTitle,
  signOutWarning,
} from '../hooks/useSignOut';
import type { SignOutGuard } from '../hooks/useSignOut';

export interface SignOutGuardModalProps {
  guard: SignOutGuard;
}

const SignOutGuardModal: React.FC<SignOutGuardModalProps> = ({ guard }) => (
  <ConfirmationModal
    visible={guard.confirming}
    tone="danger"
    icon={guard.pendingCount > 0 ? 'cloud-upload-outline' : 'logout'}
    title={signOutTitle(guard.pendingCount)}
    message={signOutWarning(guard.pendingCount)}
    retains={
      guard.pendingCount > 0
        ? ['Everything you saved offline stays on this device']
        : undefined
    }
    confirmLabel={signOutConfirmLabel(guard.pendingCount)}
    cancelLabel="Stay signed in"
    onConfirm={guard.confirmSignOut}
    onCancel={guard.cancelSignOut}
  />
);

export default SignOutGuardModal;
