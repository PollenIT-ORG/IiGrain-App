import { API_BASE_URL } from "../config/apiConfig";

// Plain fetch client for the PUBLIC Program Admin Survey (/program-admin-survey).
// Same shape as surveyApi but every survey call is scoped by the program's link
// token. Kept separate from the admin's authenticated axios instance.

export type Category = "gold" | "silver" | "bronze" | "not_qualified";

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "not_qualified"
  | "qualified"
  | "contract_sent"
  | "contract_signed"
  | "enrolled";

export interface SurveyQuestion {
  id: string;
  category_id: string | null;
  question_text: string;
  help_text: string | null;
  weight: number;
  sort_order: number;
  options: string[];
}

export interface SurveyCategoryNode {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  question_count?: number;
  questions: SurveyQuestion[];
}

export interface SurveyStructure {
  programName: string;
  /** The survey being answered, named under the program it belongs to. */
  surveyName: string;
  description: string | null;
  categories: SurveyCategoryNode[];
  scaleLabels: string[];
}

export interface EmailCheck {
  state: "new" | "draft" | "submitted";
  statusToken: string | null;
  draft: {
    firstName: string | null;
    lastName: string | null;
    farmName: string | null;
    referralSource: string | null;
    state: string | null;
    totalAcres: string | null;
    answers: Record<string, number>;
  } | null;
}

export interface BasicDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  farmName?: string | null;
  referralSource?: string | null;
  state?: string | null;
  totalAcres?: number | null;
}

export interface SubmitResult {
  statusToken: string;
  qualified: boolean;
  message: string;
  category: Category;
}

export interface StatusResponse {
  fullName: string;
  email: string;
  programName: string;
  state: string | null;
  totalAcres: string | null;
  status: SubmissionStatus;
  category: Category;
  score: number;
  message: string;
  contractToken: string | null;
  contractSignedAt: string | null;
  appLink: string;
}

export interface ContractView {
  contract: {
    id: string;
    signed: boolean;
    signedName: string | null;
    expiresAt: string;
  };
  // What the admin panel set for this program. When pdfUrl is present that PDF
  // is the contract; otherwise the clause wording is shown.
  body: {
    intro: string | null;
    clauses: Array<{ heading: string; body: string }>;
    pdfUrl: string | null;
  };
  producer: {
    fullName: string;
    email: string;
    programName: string;
    state: string;
    totalAcres: string;
  };
}

export class SurveyApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  let json: {
    message?: string;
    data?: T;
    errors?: Array<{ field: string; message: string }>;
  } = {};
  try {
    json = await res.json();
  } catch {
    // non-JSON
  }
  if (!res.ok) {
    const fieldErrors: Record<string, string> = {};
    for (const e of json.errors ?? []) fieldErrors[e.field] = e.message;
    throw new SurveyApiError(
      res.status,
      json.message ?? "Something went wrong. Please try again.",
      fieldErrors
    );
  }
  return json.data as T;
}

const BASE = "/program-admin-survey";

// The survey-scoped calls take the program's link token; OTP, status and
// contract calls are keyed by their own token.
export const programSurveyApi = {
  structure: (token: string) =>
    request<SurveyStructure>(`${BASE}/${token}/structure`),
  checkEmail: (token: string, email: string) =>
    request<EmailCheck>(`${BASE}/${token}/check-email`, {
      method: "POST",
      body: { email },
    }),
  sendOtp: (email: string): Promise<{ code?: string }> =>
    request(`${BASE}/send-otp`, { method: "POST", body: { email } }),
  verifyOtp: (email: string, code: string): Promise<{ verified: boolean }> =>
    request(`${BASE}/verify-otp`, { method: "POST", body: { email, code } }),
  saveDraft: (
    token: string,
    details: BasicDetails,
    answers: Record<string, number>
  ): Promise<{ statusToken: string }> =>
    request(`${BASE}/${token}/save-draft`, {
      method: "POST",
      body: { ...details, answers },
    }),
  submit: (
    token: string,
    details: BasicDetails,
    answers: Record<string, number>
  ): Promise<SubmitResult> =>
    request(`${BASE}/${token}/submit`, {
      method: "POST",
      body: { ...details, answers },
    }),
  status: (statusToken: string) =>
    request<StatusResponse>(`${BASE}/status/${statusToken}`),
  contract: (token: string) =>
    request<ContractView>(`${BASE}/contract/${token}`),
  signContract: (
    token: string,
    input: { signedName: string; signatureImage?: string | null }
  ): Promise<{ contract: { id: string; signedAt: string } }> =>
    request(`${BASE}/contract/${token}/sign`, {
      method: "POST",
      body: { ...input, accepted: true },
    }),
};
