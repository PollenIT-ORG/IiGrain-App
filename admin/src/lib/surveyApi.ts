import { API_BASE_URL } from "../config/apiConfig";

// Plain fetch client for the PUBLIC survey (/standalone/*). Kept separate from
// the admin's authenticated axios instance: the survey has no login, so these
// calls never attach a token or trigger the admin's auth handling.

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
  producer: { fullName: string; email: string; state: string; totalAcres: string };
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

export const surveyApi = {
  structure: () => request<SurveyStructure>("/standalone/structure"),
  checkEmail: (email: string) =>
    request<EmailCheck>("/standalone/check-email", {
      method: "POST",
      body: { email },
    }),
  saveDraft: (
    details: BasicDetails,
    answers: Record<string, number>
  ): Promise<{ statusToken: string }> =>
    request("/standalone/save-draft", {
      method: "POST",
      body: { ...details, answers },
    }),
  submit: (
    details: BasicDetails,
    answers: Record<string, number>
  ): Promise<SubmitResult> =>
    request("/standalone/submit", {
      method: "POST",
      body: { ...details, answers },
    }),
  status: (token: string) =>
    request<StatusResponse>(`/standalone/status/${token}`),
  lookupStatus: (email: string): Promise<{ statusToken: string }> =>
    request("/standalone/status-lookup", { method: "POST", body: { email } }),
  contract: (token: string) =>
    request<ContractView>(`/standalone/contract/${token}`),
  signContract: (
    token: string,
    input: { signedName: string; signatureImage?: string | null }
  ): Promise<{ contract: { id: string; signedAt: string } }> =>
    request(`/standalone/contract/${token}/sign`, {
      method: "POST",
      body: { ...input, accepted: true },
    }),
};
