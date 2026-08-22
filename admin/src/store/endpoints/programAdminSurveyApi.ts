import { apiSlice } from "../api";
import type { ApiPaged, ApiSuccess, PageMeta } from "../../types";

// The Program Admin Survey module: templates, programs (a program + its survey
// link), and the submissions to them - all scoped to the caller.

export type Category = "gold" | "silver" | "bronze" | "not_qualified";

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "not_qualified"
  | "qualified"
  | "contract_sent"
  | "contract_signed"
  | "enrolled"
  | "withdrawn";

export const CATEGORY_LABEL: Record<Category, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  not_qualified: "Not Qualified",
};

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  draft: "Registered",
  submitted: "Under Review",
  qualified: "Qualified",
  not_qualified: "Not Qualified",
  contract_sent: "Contract Sent",
  contract_signed: "Contract Signed",
  enrolled: "Enrolled",
  withdrawn: "Withdrawn",
};

export const CATEGORY_STYLE: Record<Category, string> = {
  gold: "bg-amber-100 text-amber-700",
  silver: "bg-slate-100 text-slate-600",
  bronze: "bg-orange-100 text-orange-700",
  not_qualified: "bg-rose-100 text-rose-700",
};

export const STATUS_DOT: Record<SubmissionStatus, string> = {
  draft: "bg-indigo-500",
  submitted: "bg-amber-500",
  qualified: "bg-amber-500",
  not_qualified: "bg-rose-500",
  contract_sent: "bg-blue-500",
  contract_signed: "bg-blue-500",
  enrolled: "bg-emerald-500",
  withdrawn: "bg-gray-400",
};

export const SCALE_LABELS = [
  "Not at all",
  "To a small extent",
  "To a moderate extent",
  "To a great extent",
];

export interface Template {
  id: string;
  owner_id: string | null;
  is_global: boolean;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  category_count?: number;
  question_count?: number;
}

export interface TemplateCategory {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  question_count?: number;
}

export interface TemplateQuestion {
  id: string;
  template_id: string;
  category_id: string | null;
  question_text: string;
  help_text: string | null;
  weight: number;
  sort_order: number;
  is_active: boolean;
  options: Array<string | null>;
}

export interface ScoringRule {
  id: string;
  template_id: string;
  category: string;
  min_score: number;
  max_score: number;
  is_active: boolean;
}

export interface TemplateDetail {
  template: Template;
  categories: TemplateCategory[];
  questions: TemplateQuestion[];
  scoringRules: ScoringRule[];
}

export interface Program {
  id: string;
  owner_id: string;
  // The program (from the Programs module) this survey is attached to.
  program_id: string | null;
  name: string;
  description: string | null;
  template_id: string;
  template_name: string;
  contract_template_id: string | null;
  contract_template_name: string | null;
  token: string;
  link: string;
  is_active: boolean;
  created_at: string;
  submission_count?: number;
}

export interface ContractClause {
  heading: string;
  body: string;
}

export interface ContractTemplate {
  id: string;
  owner_id: string | null;
  is_global: boolean;
  name: string;
  intro: string | null;
  clauses: ContractClause[];
  // An uploaded contract carries the PDF the producer reads and signs.
  pdf_url: string | null;
  pdf_name: string | null;
  source: "designed" | "uploaded";
  is_active: boolean;
  created_at: string;
}

export interface StoredAnswer {
  questionId: string;
  answer: number;
  score: number;
}

export interface Submission {
  id: string;
  survey_id: string;
  survey_name: string;
  template_id: string;
  website_user_id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  farm_name: string | null;
  referral_source: string | null;
  email: string;
  phone: string | null;
  state: string | null;
  total_acres: string | null;
  answers: StoredAnswer[];
  score: number;
  auto_category: Category;
  final_category: Category;
  status: SubmissionStatus;
  status_token: string | null;
  override_reason: string | null;
  enrollment_id: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  submission_id: string;
  token: string;
  token_expires_at: string;
  signed_name: string | null;
  signature_url: string | null;
  // The signed copy: the contract plus a signature page.
  signed_pdf_url: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface ListSubmissionsParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: Category;
  /** Everything one program received, whatever survey it came through. */
  programId?: string;
  search?: string;
}

const BASE = "/program-admin-surveys";

export const programAdminSurveyApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    // ------------------------------ Templates ------------------------------
    listPasTemplates: build.query<Template[], void>({
      query: () => ({ url: `${BASE}/templates`, method: "GET" }),
      transformResponse: (res: ApiSuccess<{ templates: Template[] }>) =>
        res.data.templates,
      providesTags: ["PasTemplates"],
    }),
    getPasTemplate: build.query<TemplateDetail, string>({
      query: (id) => ({ url: `${BASE}/templates/${id}`, method: "GET" }),
      transformResponse: (res: ApiSuccess<TemplateDetail>) => res.data,
      providesTags: (_r, _e, id) => [{ type: "PasTemplate", id }],
    }),
    createPasTemplate: build.mutation<
      Template,
      { name: string; description?: string | null; basedOn: string }
    >({
      query: (data) => ({ url: `${BASE}/templates`, method: "POST", data }),
      transformResponse: (res: ApiSuccess<{ template: Template }>) =>
        res.data.template,
      invalidatesTags: ["PasTemplates"],
    }),
    updatePasTemplate: build.mutation<
      Template,
      { id: string; body: { name?: string; description?: string | null; isActive?: boolean } }
    >({
      query: ({ id, body }) => ({
        url: `${BASE}/templates/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ template: Template }>) =>
        res.data.template,
      invalidatesTags: (_r, _e, { id }) => [
        "PasTemplates",
        { type: "PasTemplate", id },
      ],
    }),
    deletePasTemplate: build.mutation<void, string>({
      query: (id) => ({ url: `${BASE}/templates/${id}`, method: "DELETE" }),
      invalidatesTags: ["PasTemplates"],
    }),
    // Which survey every new one is copied from.
    makePasTemplateGlobal: build.mutation<Template, string>({
      query: (id) => ({ url: `${BASE}/templates/${id}/global`, method: "POST" }),
      transformResponse: (res: ApiSuccess<{ template: Template }>) =>
        res.data.template,
      invalidatesTags: ["PasTemplates"],
    }),

    createPasCategory: build.mutation<
      TemplateCategory,
      {
        templateId: string;
        body: {
          name: string;
          description?: string | null;
          icon?: string | null;
          isActive?: boolean;
        };
      }
    >({
      query: ({ templateId, body }) => ({
        url: `${BASE}/templates/${templateId}/categories`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { templateId }) => [
        { type: "PasTemplate", id: templateId },
      ],
    }),
    updatePasCategory: build.mutation<
      TemplateCategory,
      {
        id: string;
        templateId: string;
        body: { name?: string; description?: string | null; icon?: string | null; isActive?: boolean };
      }
    >({
      query: ({ id, body }) => ({
        url: `${BASE}/categories/${id}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { templateId }) => [
        { type: "PasTemplate", id: templateId },
      ],
    }),
    deletePasCategory: build.mutation<void, { id: string; templateId: string }>({
      query: ({ id }) => ({ url: `${BASE}/categories/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { templateId }) => [
        { type: "PasTemplate", id: templateId },
      ],
    }),

    createPasQuestion: build.mutation<
      TemplateQuestion,
      {
        templateId: string;
        body: {
          categoryId: string;
          questionText: string;
          helpText?: string | null;
          weight?: number;
          options?: Array<string | null>;
          isActive?: boolean;
        };
      }
    >({
      query: ({ templateId, body }) => ({
        url: `${BASE}/templates/${templateId}/questions`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { templateId }) => [
        { type: "PasTemplate", id: templateId },
      ],
    }),
    updatePasQuestion: build.mutation<
      TemplateQuestion,
      {
        id: string;
        templateId: string;
        body: {
          categoryId?: string;
          questionText?: string;
          helpText?: string | null;
          weight?: number;
          options?: Array<string | null>;
          isActive?: boolean;
        };
      }
    >({
      query: ({ id, body }) => ({
        url: `${BASE}/questions/${id}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { templateId }) => [
        { type: "PasTemplate", id: templateId },
      ],
    }),
    deletePasQuestion: build.mutation<void, { id: string; templateId: string }>({
      query: ({ id }) => ({ url: `${BASE}/questions/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { templateId }) => [
        { type: "PasTemplate", id: templateId },
      ],
    }),
    updatePasScoringRule: build.mutation<
      ScoringRule,
      {
        templateId: string;
        ruleId: string;
        body: { minScore?: number; maxScore?: number; isActive?: boolean };
      }
    >({
      query: ({ templateId, ruleId, body }) => ({
        url: `${BASE}/templates/${templateId}/scoring-rules/${ruleId}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { templateId }) => [
        { type: "PasTemplate", id: templateId },
      ],
    }),

    // ------------------------------ Programs -------------------------------
    listPasPrograms: build.query<Program[], void>({
      query: () => ({ url: `${BASE}/programs`, method: "GET" }),
      transformResponse: (res: ApiSuccess<{ programs: Program[] }>) =>
        res.data.programs,
      providesTags: ["PasPrograms"],
    }),
    getPasProgram: build.query<Program, string>({
      query: (id) => ({ url: `${BASE}/programs/${id}`, method: "GET" }),
      transformResponse: (res: ApiSuccess<{ program: Program }>) =>
        res.data.program,
      providesTags: (_r, _e, id) => [{ type: "PasProgram", id }],
    }),
    // Attaches a survey to a program from the Programs module.
    createPasProgram: build.mutation<
      Program,
      {
        programId: string;
        templateId: string;
        contractTemplateId?: string | null;
        // Only from the Programs page, where changing the survey is the point.
        replace?: boolean;
      }
    >({
      query: (data) => ({ url: `${BASE}/programs`, method: "POST", data }),
      transformResponse: (res: ApiSuccess<{ program: Program }>) =>
        res.data.program,
      invalidatesTags: ["PasPrograms"],
    }),
    updatePasProgram: build.mutation<
      Program,
      {
        id: string;
        body: {
          name?: string;
          description?: string | null;
          templateId?: string;
          contractTemplateId?: string | null;
          isActive?: boolean;
        };
      }
    >({
      query: ({ id, body }) => ({
        url: `${BASE}/programs/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ program: Program }>) =>
        res.data.program,
      invalidatesTags: (_r, _e, { id }) => [
        "PasPrograms",
        { type: "PasProgram", id },
      ],
    }),
    deletePasProgram: build.mutation<void, string>({
      query: (id) => ({ url: `${BASE}/programs/${id}`, method: "DELETE" }),
      invalidatesTags: ["PasPrograms"],
    }),
    sharePasProgram: build.mutation<
      { sent: number },
      { id: string; emails: string[] }
    >({
      query: ({ id, emails }) => ({
        url: `${BASE}/programs/${id}/share`,
        method: "POST",
        data: { emails },
      }),
      transformResponse: (res: ApiSuccess<{ sent: number }>) => res.data,
    }),

    // -------------------------- Contract templates -------------------------
    listPasContracts: build.query<ContractTemplate[], void>({
      query: () => ({ url: `${BASE}/contracts`, method: "GET" }),
      transformResponse: (res: ApiSuccess<{ contracts: ContractTemplate[] }>) =>
        res.data.contracts,
      providesTags: ["PasContracts"],
    }),
    getPasContract: build.query<ContractTemplate, string>({
      query: (id) => ({ url: `${BASE}/contracts/${id}`, method: "GET" }),
      transformResponse: (res: ApiSuccess<{ contract: ContractTemplate }>) =>
        res.data.contract,
      providesTags: (_r, _e, id) => [{ type: "PasContract", id }],
    }),
    createPasContract: build.mutation<
      ContractTemplate,
      { name: string; basedOn: string }
    >({
      query: (data) => ({ url: `${BASE}/contracts`, method: "POST", data }),
      transformResponse: (res: ApiSuccess<{ contract: ContractTemplate }>) =>
        res.data.contract,
      invalidatesTags: ["PasContracts"],
    }),
    updatePasContract: build.mutation<
      ContractTemplate,
      {
        id: string;
        body: {
          name?: string;
          intro?: string | null;
          clauses?: ContractClause[];
          isActive?: boolean;
        };
      }
    >({
      query: ({ id, body }) => ({
        url: `${BASE}/contracts/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ contract: ContractTemplate }>) =>
        res.data.contract,
      invalidatesTags: (_r, _e, { id }) => [
        "PasContracts",
        { type: "PasContract", id },
      ],
    }),
    deletePasContract: build.mutation<void, string>({
      query: (id) => ({ url: `${BASE}/contracts/${id}`, method: "DELETE" }),
      invalidatesTags: ["PasContracts"],
    }),
    // Which contract a program falls back to when it has none of its own.
    makePasContractGlobal: build.mutation<ContractTemplate, string>({
      query: (id) => ({ url: `${BASE}/contracts/${id}/global`, method: "POST" }),
      transformResponse: (res: ApiSuccess<{ contract: ContractTemplate }>) =>
        res.data.contract,
      invalidatesTags: ["PasContracts"],
    }),
    // A program administrator uploads the contract PDF they were sent.
    uploadPasContract: build.mutation<
      ContractTemplate,
      { name: string; file: File }
    >({
      query: ({ name, file }) => {
        const form = new FormData();
        form.append("name", name);
        form.append("file", file);
        return { url: `${BASE}/contracts/upload`, method: "POST", data: form };
      },
      transformResponse: (res: ApiSuccess<{ contract: ContractTemplate }>) =>
        res.data.contract,
      invalidatesTags: ["PasContracts"],
    }),

    // ----------------------------- Submissions -----------------------------
    listPasSubmissions: build.query<
      { submissions: Submission[]; meta: PageMeta },
      ListSubmissionsParams
    >({
      query: (params) => ({ url: `${BASE}/submissions`, method: "GET", params }),
      transformResponse: (res: ApiPaged<{ submissions: Submission[] }>) => ({
        submissions: res.data.submissions,
        meta: res.meta,
      }),
      providesTags: ["PasSubmissions"],
    }),
    // Counts for the whole panel, or for one program's survey.
    pasSubmissionStats: build.query<
      Record<string, number>,
      { programId?: string } | void
    >({
      query: (arg) => ({
        url: `${BASE}/submissions/stats`,
        method: "GET",
        params: arg?.programId ? { programId: arg.programId } : undefined,
      }),
      transformResponse: (res: ApiSuccess<{ stats: Record<string, number> }>) =>
        res.data.stats,
      providesTags: ["PasSubmissions"],
    }),
    getPasSubmission: build.query<
      { submission: Submission; contract: Contract | null },
      string
    >({
      query: (id) => ({ url: `${BASE}/submissions/${id}`, method: "GET" }),
      transformResponse: (
        res: ApiSuccess<{ submission: Submission; contract: Contract | null }>
      ) => res.data,
      providesTags: (_r, _e, id) => [{ type: "PasSubmission", id }],
    }),
    setPasCategory: build.mutation<
      Submission,
      { id: string; category: Category; reason?: string }
    >({
      query: ({ id, category, reason }) => ({
        url: `${BASE}/submissions/${id}/category`,
        method: "PATCH",
        data: { category, reason },
      }),
      transformResponse: (res: ApiSuccess<{ submission: Submission }>) =>
        res.data.submission,
      invalidatesTags: (_r, _e, { id }) => [
        "PasSubmissions",
        { type: "PasSubmission", id },
      ],
    }),
    sendPasContract: build.mutation<void, string>({
      query: (id) => ({
        url: `${BASE}/submissions/${id}/send-contract`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, id) => [
        "PasSubmissions",
        { type: "PasSubmission", id },
      ],
    }),
    acceptPasEnroll: build.mutation<Submission, string>({
      query: (id) => ({
        url: `${BASE}/submissions/${id}/accept`,
        method: "POST",
      }),
      transformResponse: (res: ApiSuccess<{ submission: Submission }>) =>
        res.data.submission,
      invalidatesTags: (_r, _e, id) => [
        "PasSubmissions",
        { type: "PasSubmission", id },
      ],
    }),
    withdrawPasSubmission: build.mutation<void, string>({
      query: (id) => ({
        url: `${BASE}/submissions/${id}/withdraw`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, id) => [
        "PasSubmissions",
        { type: "PasSubmission", id },
      ],
    }),
    deletePasSubmission: build.mutation<void, string>({
      query: (id) => ({ url: `${BASE}/submissions/${id}`, method: "DELETE" }),
      invalidatesTags: ["PasSubmissions"],
    }),
  }),
});

export const {
  useListPasTemplatesQuery,
  useGetPasTemplateQuery,
  useCreatePasTemplateMutation,
  useUpdatePasTemplateMutation,
  useDeletePasTemplateMutation,
  useMakePasTemplateGlobalMutation,
  useCreatePasCategoryMutation,
  useUpdatePasCategoryMutation,
  useDeletePasCategoryMutation,
  useCreatePasQuestionMutation,
  useUpdatePasQuestionMutation,
  useDeletePasQuestionMutation,
  useUpdatePasScoringRuleMutation,
  useListPasProgramsQuery,
  useGetPasProgramQuery,
  useCreatePasProgramMutation,
  useUpdatePasProgramMutation,
  useDeletePasProgramMutation,
  useSharePasProgramMutation,
  useListPasContractsQuery,
  useGetPasContractQuery,
  useCreatePasContractMutation,
  useUpdatePasContractMutation,
  useDeletePasContractMutation,
  useMakePasContractGlobalMutation,
  useUploadPasContractMutation,
  useListPasSubmissionsQuery,
  useLazyListPasSubmissionsQuery,
  usePasSubmissionStatsQuery,
  useGetPasSubmissionQuery,
  useSetPasCategoryMutation,
  useSendPasContractMutation,
  useAcceptPasEnrollMutation,
  useWithdrawPasSubmissionMutation,
  useDeletePasSubmissionMutation,
} = programAdminSurveyApi;
