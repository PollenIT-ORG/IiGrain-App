import { apiSlice } from "../api";
import type {
  AssessmentCategory,
  AssessmentImportResult,
  AssessmentQuestion,
  AssessmentReview,
  AssessmentReviewDetail,
  AssessmentTemplate,
  AnswerExtra,
  PageMeta,
  QuestionKind,
  QuestionType,
} from "../../types";

interface CreateTemplateBody {
  name: string;
  description?: string | null;
  // "global", "blank" or the id of a template to copy.
  basedOn: string;
  // Only with "blank": whether it holds multiple choice or input based questions.
  questionKind?: "mcq" | "input";
}

interface UpdateTemplateBody {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

interface CreateCategoryBody {
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

type UpdateCategoryBody = Partial<CreateCategoryBody>;

interface ReorderItem {
  id: string;
  sortOrder: number;
}

interface ListQuestionsParams {
  templateId: string;
  page?: number;
  limit?: number;
  categoryId?: string;
  isActive?: boolean;
  search?: string;
}

export interface QuestionOptionBody {
  optionText: string;
  score: number;
}

interface CreateQuestionBody {
  categoryId: string;
  questionCode?: string | null;
  questionText: string;
  questionType?: QuestionType;
  maxScore?: number;
  evidenceMode?: AnswerExtra;
  commentMode?: AnswerExtra;
  options?: QuestionOptionBody[];
  guidanceNote?: string | null;
  score0Description?: string | null;
  score1Description?: string | null;
  score2Description?: string | null;
  score3Description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

type UpdateQuestionBody = Partial<CreateQuestionBody>;

/** One field of a form; no id means it is being added now. */
export interface CategoryFieldBody {
  id?: string;
  questionCode?: string | null;
  questionText: string;
  questionType: QuestionType;
  maxScore?: number;
  options?: QuestionOptionBody[];
  evidenceMode?: AnswerExtra;
  commentMode?: AnswerExtra;
  isActive?: boolean;
}

// Counts on the template rows move with every category or question change.
const BANK_CHANGED = ["AssessmentTemplates", "AssessmentTemplate", "AssessmentCategories", "AssessmentQuestions"] as const;

export const assessmentApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listTemplates: build.query<AssessmentTemplate[], void>({
      query: () => ({ url: "/assessments/templates" }),
      transformResponse: (r: { data: { templates: AssessmentTemplate[] } }) => r.data.templates,
      providesTags: ["AssessmentTemplates"],
    }),

    listTemplatesPage: build.query<
      { templates: AssessmentTemplate[]; meta: PageMeta },
      { page: number; limit: number; search?: string; kind?: QuestionKind }
    >({
      query: (params) => ({ url: "/assessments/templates", params }),
      transformResponse: (r: { data: { templates: AssessmentTemplate[] }; meta: PageMeta }) => ({
        templates: r.data.templates,
        meta: r.meta,
      }),
      providesTags: ["AssessmentTemplates"],
    }),

    getTemplate: build.query<AssessmentTemplate, string>({
      query: (id) => ({ url: `/assessments/templates/${id}` }),
      transformResponse: (r: { data: { template: AssessmentTemplate } }) => r.data.template,
      providesTags: (_r, _e, id) => [{ type: "AssessmentTemplate", id }],
    }),

    createTemplate: build.mutation<AssessmentTemplate, CreateTemplateBody>({
      query: (body) => ({ url: "/assessments/templates", method: "POST", data: body }),
      transformResponse: (r: { data: { template: AssessmentTemplate } }) => r.data.template,
      invalidatesTags: ["AssessmentTemplates"],
    }),

    updateTemplate: build.mutation<AssessmentTemplate, { id: string; body: UpdateTemplateBody }>({
      query: ({ id, body }) => ({ url: `/assessments/templates/${id}`, method: "PATCH", data: body }),
      transformResponse: (r: { data: { template: AssessmentTemplate } }) => r.data.template,
      invalidatesTags: (_r, _e, { id }) => ["AssessmentTemplates", { type: "AssessmentTemplate", id }, "Program"],
    }),

    deleteTemplate: build.mutation<void, string>({
      query: (id) => ({ url: `/assessments/templates/${id}`, method: "DELETE" }),
      invalidatesTags: ["AssessmentTemplates"],
    }),

    makeTemplateGlobal: build.mutation<AssessmentTemplate, string>({
      query: (id) => ({ url: `/assessments/templates/${id}/global`, method: "POST" }),
      transformResponse: (r: { data: { template: AssessmentTemplate } }) => r.data.template,
      invalidatesTags: ["AssessmentTemplates", "AssessmentTemplate"],
    }),

    setTemplateLock: build.mutation<AssessmentTemplate, { id: string; locked: boolean }>({
      query: ({ id, locked }) => ({
        url: `/assessments/templates/${id}/lock`,
        method: locked ? "POST" : "DELETE",
      }),
      transformResponse: (r: { data: { template: AssessmentTemplate } }) => r.data.template,
      invalidatesTags: (_r, _e, { id }) => ["AssessmentTemplates", { type: "AssessmentTemplate", id }],
    }),

    listCategories: build.query<AssessmentCategory[], string>({
      query: (templateId) => ({ url: `/assessments/templates/${templateId}/categories` }),
      transformResponse: (r: { data: { categories: AssessmentCategory[] } }) => r.data.categories,
      providesTags: ["AssessmentCategories"],
    }),

    getCategory: build.query<AssessmentCategory, string>({
      query: (id) => ({ url: `/assessments/categories/${id}` }),
      transformResponse: (r: { data: { category: AssessmentCategory } }) => r.data.category,
      providesTags: (_r, _e, id) => [{ type: "AssessmentCategory", id }],
    }),

    createCategory: build.mutation<AssessmentCategory, { templateId: string; body: CreateCategoryBody }>({
      query: ({ templateId, body }) => ({
        url: `/assessments/templates/${templateId}/categories`,
        method: "POST",
        data: body,
      }),
      transformResponse: (r: { data: { category: AssessmentCategory } }) => r.data.category,
      invalidatesTags: [...BANK_CHANGED],
    }),

    updateCategory: build.mutation<AssessmentCategory, { id: string; body: UpdateCategoryBody }>({
      query: ({ id, body }) => ({ url: `/assessments/categories/${id}`, method: "PATCH", data: body }),
      transformResponse: (r: { data: { category: AssessmentCategory } }) => r.data.category,
      invalidatesTags: (_r, _e, { id }) => [...BANK_CHANGED, { type: "AssessmentCategory", id }],
    }),

    deleteCategory: build.mutation<void, string>({
      query: (id) => ({ url: `/assessments/categories/${id}`, method: "DELETE" }),
      invalidatesTags: [...BANK_CHANGED],
    }),

    reorderCategories: build.mutation<void, { templateId: string; items: ReorderItem[] }>({
      query: ({ templateId, items }) => ({
        url: `/assessments/templates/${templateId}/categories/reorder`,
        method: "PATCH",
        data: { items },
      }),
      invalidatesTags: ["AssessmentCategories"],
    }),

    listQuestions: build.query<{ questions: AssessmentQuestion[]; meta: PageMeta }, ListQuestionsParams>({
      query: ({ templateId, ...params }) => ({
        url: `/assessments/templates/${templateId}/questions`,
        params,
      }),
      transformResponse: (r: { data: { questions: AssessmentQuestion[]; meta: PageMeta } }) => r.data,
      providesTags: ["AssessmentQuestions"],
    }),

    getQuestion: build.query<AssessmentQuestion, string>({
      query: (id) => ({ url: `/assessments/questions/${id}` }),
      transformResponse: (r: { data: { question: AssessmentQuestion } }) => r.data.question,
      providesTags: (_r, _e, id) => [{ type: "AssessmentQuestion", id }],
    }),

    createQuestion: build.mutation<AssessmentQuestion, { templateId: string; body: CreateQuestionBody }>({
      query: ({ templateId, body }) => ({
        url: `/assessments/templates/${templateId}/questions`,
        method: "POST",
        data: body,
      }),
      transformResponse: (r: { data: { question: AssessmentQuestion } }) => r.data.question,
      invalidatesTags: [...BANK_CHANGED],
    }),

    updateQuestion: build.mutation<AssessmentQuestion, { id: string; body: UpdateQuestionBody }>({
      query: ({ id, body }) => ({ url: `/assessments/questions/${id}`, method: "PATCH", data: body }),
      transformResponse: (r: { data: { question: AssessmentQuestion } }) => r.data.question,
      invalidatesTags: (_r, _e, { id }) => [...BANK_CHANGED, { type: "AssessmentQuestion", id }],
    }),

    deleteQuestion: build.mutation<void, string>({
      query: (id) => ({ url: `/assessments/questions/${id}`, method: "DELETE" }),
      invalidatesTags: [...BANK_CHANGED],
    }),

    reorderQuestions: build.mutation<void, { templateId: string; items: ReorderItem[] }>({
      query: ({ templateId, items }) => ({
        url: `/assessments/templates/${templateId}/questions/reorder`,
        method: "PATCH",
        data: { items },
      }),
      invalidatesTags: ["AssessmentQuestions"],
    }),

    // A whole form of one category, saved in one call.
    saveCategoryFields: build.mutation<
      AssessmentQuestion[],
      { templateId: string; categoryId: string; fields: CategoryFieldBody[] }
    >({
      query: ({ templateId, categoryId, fields }) => ({
        url: `/assessments/templates/${templateId}/categories/${categoryId}/fields`,
        method: "PUT",
        data: { fields },
      }),
      transformResponse: (r: { data: { questions: AssessmentQuestion[] } }) => r.data.questions,
      invalidatesTags: [...BANK_CHANGED],
    }),

    importTemplateFile: build.mutation<AssessmentImportResult & { template: AssessmentTemplate }, FormData>({
      query: (form) => ({ url: "/assessments/templates/import", method: "POST", data: form }),
      transformResponse: (r: { data: AssessmentImportResult & { template: AssessmentTemplate } }) => r.data,
      invalidatesTags: [...BANK_CHANGED],
    }),

    importQuestions: build.mutation<AssessmentImportResult, { templateId: string; form: FormData }>({
      query: ({ templateId, form }) => ({
        url: `/assessments/templates/${templateId}/questions/import`,
        method: "POST",
        data: form,
      }),
      transformResponse: (r: { data: AssessmentImportResult }) => r.data,
      invalidatesTags: [...BANK_CHANGED],
    }),

    getReview: build.query<AssessmentReviewDetail, string>({
      query: (id) => ({ url: `/assessments/reviews/${id}` }),
      transformResponse: (r: { data: AssessmentReviewDetail }) => r.data,
      providesTags: (_r, _e, id) => [{ type: "AssessmentReview", id }],
    }),

    saveReviewScores: build.mutation<
      AssessmentReview,
      { id: string; scores?: { questionId: string; recordId?: string | null; score: number }[]; note?: string | null }
    >({
      query: ({ id, ...body }) => ({ url: `/assessments/reviews/${id}`, method: "PATCH", data: body }),
      transformResponse: (r: { data: { review: AssessmentReview } }) => r.data.review,
      invalidatesTags: (_r, _e, { id }) => ["AssessmentReviews", { type: "AssessmentReview", id }],
    }),

    approveReview: build.mutation<
      AssessmentReview,
      {
        id: string;
        scores?: { questionId: string; recordId?: string | null; score: number }[];
        // One score per category, in place of scoring every answer.
        categoryScores?: { categoryId: string; score: number }[];
        // One score for the whole assessment, in place of scoring every answer.
        overallScore?: number;
        note?: string | null;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/assessments/reviews/${id}/approve`,
        method: "POST",
        data: body,
      }),
      transformResponse: (r: { data: { review: AssessmentReview } }) => r.data.review,
      invalidatesTags: (_r, _e, { id }) => ["AssessmentReviews", { type: "AssessmentReview", id }],
    }),
  }),
});

export const {
  useListTemplatesQuery,
  useListTemplatesPageQuery,
  useGetTemplateQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  useMakeTemplateGlobalMutation,
  useListCategoriesQuery,
  useGetCategoryQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useReorderCategoriesMutation,
  useListQuestionsQuery,
  useGetQuestionQuery,
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
  useReorderQuestionsMutation,
  useImportTemplateFileMutation,
  useImportQuestionsMutation,
  useSaveCategoryFieldsMutation,
  useSetTemplateLockMutation,
  useGetReviewQuery,
  useSaveReviewScoresMutation,
  useApproveReviewMutation,
} = assessmentApi;
