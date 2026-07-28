import { apiSlice } from "../api";
import type { ApiPaged, ApiSuccess, PageMeta } from "../../types";

// The eligibility survey flow that happens on the public website before a
// producer can register in the mobile app.

export type Category = "gold" | "silver" | "bronze" | "not_qualified";

export type SubmissionStatus =
  | "submitted"
  | "not_qualified"
  | "qualified"
  | "contract_sent"
  | "contract_signed"
  | "enrolled";

export const SCALE_LABELS = [
  "Not at all",
  "To a small extent",
  "To a moderate extent",
  "To a great extent",
];

export interface StoredAnswer {
  questionId: string;
  // 0-3 on the assessment scale.
  answer: number;
  score: number;
}

export type SubmissionChannel = "website" | "standalone";

export interface Submission {
  id: string;
  website_user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  state: string;
  total_acres: string;
  answers: StoredAnswer[];
  score: number;
  auto_category: Category;
  final_category: Category;
  status: SubmissionStatus;
  channel: SubmissionChannel;
  enrollment_id: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const CHANNEL_LABEL: Record<SubmissionChannel, string> = {
  website: "Website",
  standalone: "Survey link",
};

export const CHANNEL_STYLE: Record<SubmissionChannel, string> = {
  website: "bg-gray-300/60 text-gray-700",
  standalone: "bg-info/10 text-info",
};

export interface Contract {
  id: string;
  token: string;
  token_expires_at: string;
  signed_name: string | null;
  signature_url: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  category_id: string | null;
  question_text: string;
  help_text: string | null;
  weight: number;
  sort_order: number;
  is_active: boolean;
}

export interface SurveyCategoryItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  question_count?: number;
}

export interface CategoryBody {
  name: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ScoringRule {
  id: string;
  category: Category;
  min_score: number;
  max_score: number;
  is_active: boolean;
}

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ListSubmissionsParams {
  page?: number;
  limit?: number;
  status?: SubmissionStatus;
  category?: Category;
  channel?: SubmissionChannel;
  search?: string;
}

export interface QuestionBody {
  categoryId: string;
  questionText: string;
  helpText?: string | null;
  weight?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export const eligibilityApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    // ----------------------------- Submissions -----------------------------
    listSubmissions: build.query<
      { submissions: Submission[]; meta: PageMeta },
      ListSubmissionsParams
    >({
      query: (params) => ({
        url: "/eligibility/submissions",
        method: "GET",
        params,
      }),
      transformResponse: (res: ApiPaged<{ submissions: Submission[] }>) => ({
        submissions: res.data.submissions,
        meta: res.meta,
      }),
      providesTags: ["EligibilitySubmissions"],
    }),

    submissionStats: build.query<Record<string, number>, void>({
      query: () => ({ url: "/eligibility/submissions/stats", method: "GET" }),
      transformResponse: (res: ApiSuccess<{ stats: Record<string, number> }>) =>
        res.data.stats,
      providesTags: ["EligibilitySubmissions"],
    }),

    getSubmission: build.query<
      { submission: Submission; contract: Contract | null },
      string
    >({
      query: (id) => ({ url: `/eligibility/submissions/${id}`, method: "GET" }),
      transformResponse: (
        res: ApiSuccess<{ submission: Submission; contract: Contract | null }>
      ) => res.data,
      providesTags: (_r, _e, id) => [{ type: "EligibilitySubmission", id }],
    }),

    setSubmissionCategory: build.mutation<
      Submission,
      { id: string; category: Category }
    >({
      query: ({ id, category }) => ({
        url: `/eligibility/submissions/${id}/category`,
        method: "PATCH",
        data: { category },
      }),
      transformResponse: (res: ApiSuccess<{ submission: Submission }>) =>
        res.data.submission,
      invalidatesTags: (_r, _e, { id }) => [
        "EligibilitySubmissions",
        { type: "EligibilitySubmission", id },
      ],
    }),

    sendContract: build.mutation<void, string>({
      query: (id) => ({
        url: `/eligibility/submissions/${id}/send-contract`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, id) => [
        "EligibilitySubmissions",
        { type: "EligibilitySubmission", id },
      ],
    }),

    acceptAndEnroll: build.mutation<Submission, string>({
      query: (id) => ({
        url: `/eligibility/submissions/${id}/accept`,
        method: "POST",
      }),
      transformResponse: (res: ApiSuccess<{ submission: Submission }>) =>
        res.data.submission,
      invalidatesTags: (_r, _e, id) => [
        "EligibilitySubmissions",
        { type: "EligibilitySubmission", id },
      ],
    }),

    shareSurvey: build.mutation<{ sent: number; link: string }, string[]>({
      query: (emails) => ({
        url: "/eligibility/share-survey",
        method: "POST",
        data: { emails },
      }),
      transformResponse: (res: ApiSuccess<{ sent: number; link: string }>) =>
        res.data,
    }),

    deleteSubmission: build.mutation<void, string>({
      query: (id) => ({
        url: `/eligibility/submissions/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, id) => [
        "EligibilitySubmissions",
        { type: "EligibilitySubmission", id },
      ],
    }),

    // ------------------------------ Categories -----------------------------
    listSurveyCategories: build.query<{ categories: SurveyCategoryItem[] }, void>({
      query: () => ({ url: "/eligibility/categories", method: "GET" }),
      transformResponse: (res: ApiSuccess<{ categories: SurveyCategoryItem[] }>) =>
        res.data,
      providesTags: ["SurveyQuestions"],
    }),
    createSurveyCategory: build.mutation<SurveyCategoryItem, CategoryBody>({
      query: (body) => ({
        url: "/eligibility/categories",
        method: "POST",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ category: SurveyCategoryItem }>) =>
        res.data.category,
      invalidatesTags: ["SurveyQuestions"],
    }),
    updateSurveyCategory: build.mutation<
      SurveyCategoryItem,
      { id: string; body: Partial<CategoryBody> }
    >({
      query: ({ id, body }) => ({
        url: `/eligibility/categories/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ category: SurveyCategoryItem }>) =>
        res.data.category,
      invalidatesTags: ["SurveyQuestions"],
    }),
    deleteSurveyCategory: build.mutation<void, string>({
      query: (id) => ({ url: `/eligibility/categories/${id}`, method: "DELETE" }),
      invalidatesTags: ["SurveyQuestions"],
    }),

    // ------------------------------ Questions ------------------------------
    listSurveyQuestions: build.query<
      { questions: SurveyQuestion[]; maxScore: number },
      void
    >({
      query: () => ({ url: "/eligibility/questions", method: "GET" }),
      transformResponse: (
        res: ApiSuccess<{ questions: SurveyQuestion[]; maxScore: number }>
      ) => res.data,
      providesTags: ["SurveyQuestions"],
    }),

    createSurveyQuestion: build.mutation<SurveyQuestion, QuestionBody>({
      query: (body) => ({
        url: "/eligibility/questions",
        method: "POST",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ question: SurveyQuestion }>) =>
        res.data.question,
      invalidatesTags: ["SurveyQuestions", "ScoringRules"],
    }),

    updateSurveyQuestion: build.mutation<
      SurveyQuestion,
      { id: string; body: Partial<QuestionBody> }
    >({
      query: ({ id, body }) => ({
        url: `/eligibility/questions/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ question: SurveyQuestion }>) =>
        res.data.question,
      invalidatesTags: ["SurveyQuestions", "ScoringRules"],
    }),

    deleteSurveyQuestion: build.mutation<void, string>({
      query: (id) => ({ url: `/eligibility/questions/${id}`, method: "DELETE" }),
      invalidatesTags: ["SurveyQuestions", "ScoringRules"],
    }),

    reorderSurveyQuestions: build.mutation<
      void,
      Array<{ id: string; sortOrder: number }>
    >({
      query: (items) => ({
        url: "/eligibility/questions/reorder",
        method: "PATCH",
        data: { items },
      }),
      invalidatesTags: ["SurveyQuestions"],
    }),

    // ---------------------------- Scoring rules ----------------------------
    listScoringRules: build.query<
      { rules: ScoringRule[]; maxScore: number },
      void
    >({
      query: () => ({ url: "/eligibility/scoring-rules", method: "GET" }),
      transformResponse: (
        res: ApiSuccess<{ rules: ScoringRule[]; maxScore: number }>
      ) => res.data,
      providesTags: ["ScoringRules"],
    }),

    updateScoringRule: build.mutation<
      ScoringRule,
      { id: string; body: { minScore?: number; maxScore?: number } }
    >({
      query: ({ id, body }) => ({
        url: `/eligibility/scoring-rules/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: ApiSuccess<{ rule: ScoringRule }>) =>
        res.data.rule,
      invalidatesTags: ["ScoringRules"],
    }),

    // ------------------------------ Enquiries ------------------------------
    listEnquiries: build.query<
      { enquiries: Enquiry[]; unreadCount: number; meta: PageMeta },
      { page?: number; limit?: number; unreadOnly?: boolean; search?: string }
    >({
      query: (params) => ({
        url: "/eligibility/enquiries",
        method: "GET",
        params: {
          ...params,
          unreadOnly: params.unreadOnly ? "true" : undefined,
        },
      }),
      transformResponse: (
        res: ApiPaged<{ enquiries: Enquiry[]; unreadCount: number }>
      ) => ({
        enquiries: res.data.enquiries,
        unreadCount: res.data.unreadCount,
        meta: res.meta,
      }),
      providesTags: ["ContactEnquiries"],
    }),

    setEnquiryRead: build.mutation<void, { id: string; isRead: boolean }>({
      query: ({ id, isRead }) => ({
        url: `/eligibility/enquiries/${id}/read`,
        method: "PATCH",
        data: { isRead },
      }),
      invalidatesTags: ["ContactEnquiries"],
    }),

    deleteEnquiry: build.mutation<void, string>({
      query: (id) => ({ url: `/eligibility/enquiries/${id}`, method: "DELETE" }),
      invalidatesTags: ["ContactEnquiries"],
    }),
  }),
});

export const {
  useListSubmissionsQuery,
  useSubmissionStatsQuery,
  useGetSubmissionQuery,
  useSetSubmissionCategoryMutation,
  useSendContractMutation,
  useAcceptAndEnrollMutation,
  useDeleteSubmissionMutation,
  useShareSurveyMutation,
  useListSurveyCategoriesQuery,
  useCreateSurveyCategoryMutation,
  useUpdateSurveyCategoryMutation,
  useDeleteSurveyCategoryMutation,
  useListSurveyQuestionsQuery,
  useCreateSurveyQuestionMutation,
  useUpdateSurveyQuestionMutation,
  useDeleteSurveyQuestionMutation,
  useReorderSurveyQuestionsMutation,
  useListScoringRulesQuery,
  useUpdateScoringRuleMutation,
  useListEnquiriesQuery,
  useSetEnquiryReadMutation,
  useDeleteEnquiryMutation,
} = eligibilityApi;

export const CATEGORY_LABEL: Record<Category, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  not_qualified: "Not Qualified",
};

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: "In review",
  not_qualified: "Not qualified",
  qualified: "Prospective Producer",
  contract_sent: "Contract sent",
  contract_signed: "Awaiting acceptance",
  enrolled: "Enrolled",
};

export const CATEGORY_STYLE: Record<Category, string> = {
  gold: "bg-accent/15 text-accent",
  silver: "bg-gray-300/60 text-gray-700",
  bronze: "bg-warning/15 text-warning",
  not_qualified: "bg-danger/10 text-danger",
};

export const STATUS_STYLE: Record<SubmissionStatus, string> = {
  submitted: "bg-info/10 text-info",
  not_qualified: "bg-danger/10 text-danger",
  qualified: "bg-secondary/15 text-secondary",
  contract_sent: "bg-accent/15 text-accent",
  contract_signed: "bg-info/10 text-info",
  enrolled: "bg-success/10 text-success",
};
