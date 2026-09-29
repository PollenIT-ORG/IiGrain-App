export interface Faq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export type ContactField = 'name' | 'email' | 'phone' | 'subject' | 'message';

export type ContactFieldErrors = Partial<Record<ContactField, string>>;

export interface ContactEnquiryInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface ContactEnquiryResult {
  id: string | null;
  message: string;
}

export const CONTACT_LIMITS = {
  name: { min: 2, max: 150 },
  email: { min: 3, max: 255 },
  subject: { min: 3, max: 150 },
  message: { min: 10, max: 5000 },
} as const;

export const CONTACT_SUCCESS_FALLBACK =
  'Thanks for getting in touch. Our team will reply by email.';
