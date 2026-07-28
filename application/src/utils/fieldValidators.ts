import { isStrongPassword, isValidEmail } from './validators';

export type FieldValidator<V> = (value: string, values: V) => string | undefined;

const PASSWORD_RULE_MESSAGE = 'Use 8–64 characters with a letter and a number';

export const requiredValidator =
  <V>(message: string): FieldValidator<V> =>
  value =>
    value.trim() ? undefined : message;

export const requiredNameValidator =
  <V>(label: string, min = 2): FieldValidator<V> =>
  value => {
    const v = value.trim();
    if (!v) {
      return `${label} is required`;
    }
    return v.length >= min ? undefined : `${label} must be at least ${min} characters`;
  };

export const optionalPositiveNumberValidator =
  <V>(message: string): FieldValidator<V> =>
  value => {
    const v = value.trim();
    if (!v) {
      return undefined;
    }
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? undefined : message;
  };

export const requiredPositiveNumberValidator =
  <V>(label: string, invalidMessage: string): FieldValidator<V> =>
  value => {
    const v = value.trim();
    if (!v) {
      return `${label} is required`;
    }
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? undefined : invalidMessage;
  };

export const optionalIsoDateValidator =
  <V>(message: string): FieldValidator<V> =>
  value => {
    const v = value.trim();
    if (!v) {
      return undefined;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return message;
    }
    const parsed = new Date(v);
    return Number.isNaN(parsed.getTime()) ? message : undefined;
  };

export const nameValidator: FieldValidator<Record<string, string>> = value =>
  value.trim() ? undefined : 'Full name is required';

export const emailValidator: FieldValidator<Record<string, string>> = value => {
  if (!value.trim()) {
    return 'Email is required';
  }
  return isValidEmail(value) ? undefined : 'Enter a valid email address';
};

export const passwordValidator: FieldValidator<Record<string, string>> = value => {
  if (!value) {
    return 'Password is required';
  }
  return isStrongPassword(value) ? undefined : PASSWORD_RULE_MESSAGE;
};

export const confirmPasswordValidator =
  <V extends Record<string, string>>(passwordKey: keyof V): FieldValidator<V> =>
  (value, values) =>
    value === values[passwordKey] ? undefined : 'Passwords do not match';

export const phoneFieldMessage = (phone: string, isValid: boolean): string | undefined => {
  if (!phone.trim()) {
    return 'Phone number is required';
  }
  return isValid ? undefined : 'Enter a valid phone number';
};
