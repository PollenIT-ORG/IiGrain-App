import { ICONS } from '../../components/AppIcon';
import type { PasswordFlowPurpose } from '../../navigation/navigationTypes';

export const PASSWORD_FLOW_STEPS = ['Email', 'Verify', 'Password'] as const;

export interface PasswordFlowNotice {
  readonly icon: string;
  readonly title: string;
  readonly message: string;
}

export interface PasswordFlowCopy {
  readonly request: {
    readonly title: string;
    readonly subtitle: string;
    readonly emailLabel: string;
    readonly emailHint?: string;
    readonly submit: string;
  };
  readonly code: {
    readonly title: string;
    readonly intro: string;
    readonly submit: string;
  };
  readonly password: {
    readonly title: string;
    readonly subtitle: string;
    readonly label: string;
    readonly confirmLabel: string;
    readonly submit: string;
    readonly success: string;
  };
  readonly notice?: PasswordFlowNotice;
}

const RESET: PasswordFlowCopy = {
  request: {
    title: 'Forgot password',
    subtitle: 'Enter your email and we will send you a 6-digit reset code.',
    emailLabel: 'Email',
    submit: 'Send reset code',
  },
  code: {
    title: 'Reset your password',
    intro: 'Enter the 6-digit code we sent to reset the password for',
    submit: 'Continue',
  },
  password: {
    title: 'Set a new password',
    subtitle: 'Create a new password for',
    label: 'New password',
    confirmLabel: 'Confirm password',
    submit: 'Reset password',
    success: 'Your password has been updated.',
  },
};

const SETUP: PasswordFlowCopy = {
  request: {
    title: 'Set your password',
    subtitle:
      'This is your first sign in. Choose a password only you know, starting with a 6-digit code to confirm your email.',
    emailLabel: 'Your email',
    emailHint: 'This is the address the office created your account with.',
    submit: 'Send code',
  },
  code: {
    title: 'Confirm it is you',
    intro: 'Enter the 6-digit code we sent to',
    submit: 'Continue',
  },
  password: {
    title: 'Choose your password',
    subtitle: 'This password replaces the temporary one for',
    label: 'Your new password',
    confirmLabel: 'Confirm password',
    submit: 'Save and continue',
    success: 'Your password is set.',
  },
  notice: {
    icon: ICONS.LOCK_CHECK,
    title: 'First sign in',
    message:
      'The password from your welcome email proves who you are, but it will not open the app. Set your own password to finish.',
  },
};

export const passwordFlowCopy = (purpose: PasswordFlowPurpose): PasswordFlowCopy =>
  purpose === 'setup' ? SETUP : RESET;
