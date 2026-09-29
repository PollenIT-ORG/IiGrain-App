import { isAxiosError } from 'axios';
import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import {
  CONTACT_SUCCESS_FALLBACK,
  type ContactEnquiryInput,
  type ContactEnquiryResult,
  type ContactField,
  type ContactFieldErrors,
  type Faq,
} from '../types/support';

interface Envelope<T> {
  data?: T;
  message?: string;
}

interface RawFaq {
  id?: string;
  question?: string;
  answer?: string;
  sort_order?: number;
  sortOrder?: number;
}

interface ContactEnquiryData {
  id?: string;
  createdAt?: string;
}

const CONTACT_FIELDS: ReadonlySet<string> = new Set<ContactField>([
  'name',
  'email',
  'phone',
  'subject',
  'message',
]);

const asFaqArray = (body: unknown): RawFaq[] => {
  if (Array.isArray(body)) {
    return body as RawFaq[];
  }
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    if (Array.isArray(record.faqs)) {
      return record.faqs as RawFaq[];
    }
    if (record.data !== undefined) {
      return asFaqArray(record.data);
    }
  }
  return [];
};

const normalizeFaq = (raw: RawFaq, index: number): Faq | null => {
  const question = raw.question?.trim();
  const answer = raw.answer?.trim();
  if (!question || !answer) {
    return null;
  }
  const order = raw.sortOrder ?? raw.sort_order;
  return {
    id: raw.id ?? `faq-${index}`,
    question,
    answer,
    sortOrder: Number.isFinite(order) ? Number(order) : index,
  };
};

export const getFaqs = async (): Promise<Faq[]> => {
  const res = await http.get<unknown>(Endpoints.faqs.list, { silent: true });
  return asFaqArray(res.data)
    .map(normalizeFaq)
    .filter((faq): faq is Faq => faq !== null)
    .map((faq, index) => ({ faq, index }))
    .sort((a, b) => a.faq.sortOrder - b.faq.sortOrder || a.index - b.index)
    .map(entry => entry.faq);
};

export const submitContactEnquiry = async (
  input: ContactEnquiryInput,
): Promise<ContactEnquiryResult> => {
  const phone = input.phone?.trim();
  const res = await http.post<Envelope<ContactEnquiryData>>(
    Endpoints.support.contactEnquiries,
    {
      name: input.name.trim(),
      email: input.email.trim(),
      subject: input.subject.trim(),
      message: input.message.trim(),
      ...(phone ? { phone } : {}),
    },
    { silent: true },
  );
  return {
    id: res.data?.data?.id ?? null,
    message: res.data?.message?.trim() || CONTACT_SUCCESS_FALLBACK,
  };
};

export const contactFieldErrorsFor = (error: unknown): ContactFieldErrors => {
  if (!isAxiosError(error)) {
    return {};
  }
  const body = error.response?.data as { errors?: unknown } | undefined;
  if (!Array.isArray(body?.errors)) {
    return {};
  }
  const errors: ContactFieldErrors = {};
  for (const entry of body.errors) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const field = typeof record.field === 'string' ? record.field : null;
    const message = typeof record.message === 'string' ? record.message.trim() : '';
    if (field && message && CONTACT_FIELDS.has(field) && !errors[field as ContactField]) {
      errors[field as ContactField] = message;
    }
  }
  return errors;
};
