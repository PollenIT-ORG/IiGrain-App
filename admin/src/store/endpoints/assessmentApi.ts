import { apiSlice } from "../api";
import type { AssessmentCategory, AssessmentQuestion, PageMeta } from "../../types";

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
  page?: number;
  limit?: number;
  categoryId?: string;
  isActive?: boolean;
  search?: string;
}

interface CreateQuestionBody {
  categoryId: string;
  questionCode?: string | null;
  questionText: string;
  guidanceNote?: string | null;
  score0Description?: string | null;
  score1Description?: string | null;
  score2Description?: string | null;
  score3Description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

type UpdateQuestionBody = Partial<CreateQuestionBody>;

export const assessmentApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    listCategories: build.query<AssessmentCategory[], void>({
      query: () => ({ url: "/assessments/categories" }),
      transformResponse: (r: { data: { categories: AssessmentCategory[] } }) =>
        r.data.categories,
      providesTags: ["AssessmentCategories"],
    }),

    getCategory: build.query<AssessmentCategory, string>({
      query: (id) => ({ url: `/assessments/categories/${id}` }),
      transformResponse: (r: { data: { category: AssessmentCategory } }) =>
        r.data.category,
      providesTags: (_r, _e, id) => [{ type: "AssessmentCategory", id }],
    }),

    createCategory: build.mutation<AssessmentCategory, CreateCategoryBody>({
      query: (body) => ({
        url: "/assessments/categories",
        method: "POST",
        data: body,
      }),
      transformResponse: (r: { data: { category: AssessmentCategory } }) =>
        r.data.category,
      invalidatesTags: ["AssessmentCategories"],
    }),

    updateCategory: build.mutation<
      AssessmentCategory,
      { id: string; body: UpdateCategoryBody }
    >({
      query: ({ id, body }) => ({
        url: `/assessments/categories/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (r: { data: { category: AssessmentCategory } }) =>
        r.data.category,
      invalidatesTags: (_r, _e, { id }) => [
        "AssessmentCategories",
        { type: "AssessmentCategory", id },
      ],
    }),

    deleteCategory: build.mutation<void, string>({
      query: (id) => ({
        url: `/assessments/categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AssessmentCategories"],
    }),

    reorderCategories: build.mutation<void, ReorderItem[]>({
      query: (items) => ({
        url: "/assessments/categories/reorder",
        method: "PATCH",
        data: { items },
      }),
      invalidatesTags: ["AssessmentCategories"],
    }),

    listQuestions: build.query<
      { questions: AssessmentQuestion[]; meta: PageMeta },
      ListQuestionsParams
    >({
      query: (params) => ({ url: "/assessments/questions", params }),
      transformResponse: (r: {
        data: { questions: AssessmentQuestion[]; meta: PageMeta };
      }) => r.data,
      providesTags: ["AssessmentQuestions"],
    }),

    getQuestion: build.query<AssessmentQuestion, string>({
      query: (id) => ({ url: `/assessments/questions/${id}` }),
      transformResponse: (r: { data: { question: AssessmentQuestion } }) =>
        r.data.question,
      providesTags: (_r, _e, id) => [{ type: "AssessmentQuestion", id }],
    }),

    createQuestion: build.mutation<AssessmentQuestion, CreateQuestionBody>({
      query: (body) => ({
        url: "/assessments/questions",
        method: "POST",
        data: body,
      }),
      transformResponse: (r: { data: { question: AssessmentQuestion } }) =>
        r.data.question,
      invalidatesTags: ["AssessmentQuestions", "AssessmentCategories"],
    }),

    updateQuestion: build.mutation<
      AssessmentQuestion,
      { id: string; body: UpdateQuestionBody }
    >({
      query: ({ id, body }) => ({
        url: `/assessments/questions/${id}`,
        method: "PATCH",
        data: body,
      }),
      transformResponse: (r: { data: { question: AssessmentQuestion } }) =>
        r.data.question,
      invalidatesTags: (_r, _e, { id }) => [
        "AssessmentQuestions",
        { type: "AssessmentQuestion", id },
        "AssessmentCategories",
      ],
    }),

    deleteQuestion: build.mutation<void, string>({
      query: (id) => ({
        url: `/assessments/questions/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AssessmentQuestions", "AssessmentCategories"],
    }),

    reorderQuestions: build.mutation<void, ReorderItem[]>({
      query: (items) => ({
        url: "/assessments/questions/reorder",
        method: "PATCH",
        data: { items },
      }),
      invalidatesTags: ["AssessmentQuestions"],
    }),

    importQuestions: build.mutation<
      { created: number; skipped: number },
      FormData
    >({
      query: (form) => ({
        url: "/assessments/questions/import",
        method: "POST",
        data: form,
      }),
      transformResponse: (r: {
        data: { created: number; skipped: number };
      }) => r.data,
      invalidatesTags: ["AssessmentQuestions", "AssessmentCategories"],
    }),
  }),
});

export const {
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
  useImportQuestionsMutation,
} = assessmentApi;
