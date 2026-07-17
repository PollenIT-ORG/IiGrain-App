export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordRules {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export interface PasswordStrengthResult {
  score: number;
  strength: PasswordStrength;
  label: string;
  progress: number;
  rules: PasswordRules;
}

const MAX_SCORE = 5;

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: 'Weak Password',
  fair: 'Fair Password',
  good: 'Good Password',
  strong: 'Strong Password',
};

const toStrength = (score: number): PasswordStrength => {
  if (score <= 2) {
    return 'weak';
  }
  if (score === 3) {
    return 'fair';
  }
  if (score === 4) {
    return 'good';
  }
  return 'strong';
};

export const calculatePasswordStrength = (password: string): PasswordStrengthResult => {
  const rules: PasswordRules = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: SPECIAL_RE.test(password),
  };

  const score = Object.values(rules).filter(Boolean).length;
  const strength = toStrength(score);

  return {
    score,
    strength,
    label: STRENGTH_LABEL[strength],
    progress: score / MAX_SCORE,
    rules,
  };
};
