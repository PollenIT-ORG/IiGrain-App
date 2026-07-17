const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9]{10}$/;

export const isValidEmail = (value: string): boolean => EMAIL_RE.test(value.trim());

export const isValidPhone = (value: string): boolean => PHONE_RE.test(value.trim());

export const isStrongPassword = (value: string): boolean =>
  value.length >= 8 && value.length <= 64 && /[a-zA-Z]/.test(value) && /[0-9]/.test(value);
