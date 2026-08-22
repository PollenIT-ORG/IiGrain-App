import { createSlice } from '@reduxjs/toolkit';
import type {
  AssessmentCategorySummary,
  AssessmentQuestionDetail,
  AssessmentQuestionListItem,
  AssessmentReview,
  AssessmentSubmitResult,
  CategoryQuestionList,
  FieldAssessmentSummary,
  FieldRegenIndex,
  MyAssessmentField,
  MyAssessmentsOverview,
} from '../../types/assessment';
import { hasNextPage, mergePage, type PageMeta } from '../../types/pagination';
import { logout } from './authSlice';
import {
  fetchAssessmentSummaryThunk,
  refreshAssessmentSummaryThunk,
  fetchCategoryQuestionsThunk,
  fetchQuestionDetailThunk,
  saveAssessmentAnswerThunk,
  fetchAssessmentReviewThunk,
  submitAssessmentThunk,
  fetchMyAssessmentFieldsThunk,
  fetchMyAssessmentHistoryThunk,
  fetchFieldRegenIndexThunk,
  discardAssessmentThunk,
} from '../thunks/assessmentThunks';
import { unenrollFieldThunk } from '../thunks/enrollmentThunks';

export interface AssessmentState {
  summary: FieldAssessmentSummary | null;
  categoryQuestions: CategoryQuestionList | null;
  questionDetail: AssessmentQuestionDetail | null;
  requestedQuestionId: string | null;
  requestedCategoryScope: string | null;
  requestedSummaryFieldId: string | null;
  requestedReviewFieldId: string | null;
  review: AssessmentReview | null;
  submitResult: AssessmentSubmitResult | null;
  myFields: MyAssessmentsOverview | null;
  myFieldsMeta: PageMeta | null;
  myFieldsSearch: string;
  myHistory: MyAssessmentField[] | null;
  myHistoryCount: number;
  myHistoryMeta: PageMeta | null;
  myHistorySearch: string;
  regenIndex: FieldRegenIndex | null;
  requestedRegenFieldId: string | null;
  loadedSummaryScope: string | null;
  loadedReviewScope: string | null;
  loadedRegenScope: string | null;
  answerVersion: number;

  saving: boolean;
  loadingSummary: boolean;
  loadingQuestions: boolean;
  loadingQuestion: boolean;
  loadingReview: boolean;
  submitting: boolean;
  discarding: boolean;
  loadingMyFields: boolean;
  loadingMoreMyFields: boolean;
  loadingMyHistory: boolean;
  loadingMoreMyHistory: boolean;
  loadingRegenIndex: boolean;
  refreshing: boolean;
  error: string | null;
}

const initialState: AssessmentState = {
  summary: null,
  categoryQuestions: null,
  questionDetail: null,
  requestedQuestionId: null,
  requestedCategoryScope: null,
  requestedSummaryFieldId: null,
  requestedReviewFieldId: null,
  review: null,
  submitResult: null,
  myFields: null,
  myFieldsMeta: null,
  myFieldsSearch: '',
  myHistory: null,
  myHistoryCount: 0,
  myHistoryMeta: null,
  myHistorySearch: '',
  regenIndex: null,
  requestedRegenFieldId: null,
  loadedSummaryScope: null,
  loadedReviewScope: null,
  loadedRegenScope: null,
  answerVersion: 0,
  saving: false,
  loadingSummary: false,
  loadingQuestions: false,
  loadingQuestion: false,
  loadingReview: false,
  submitting: false,
  discarding: false,
  loadingMyFields: false,
  loadingMoreMyFields: false,
  loadingMyHistory: false,
  loadingMoreMyHistory: false,
  loadingRegenIndex: false,
  refreshing: false,
  error: null,
};

const pct = (answered: number, total: number): number =>
  total > 0 ? Math.round((answered / total) * 100) : 0;

const scopeKey = (arg: { programId: string; fieldId: string }): string =>
  `${arg.programId}:${arg.fieldId}`;

export const categoryScopeKey = (arg: {
  programId: string;
  fieldId: string;
  categoryId: string;
}): string => `${arg.programId}:${arg.fieldId}:${arg.categoryId}`;

const argSearch = (arg: { search?: string } | undefined): string =>
  arg?.search?.trim() ?? '';

const rowKey = (row: MyAssessmentField): string => `${row.programId}:${row.fieldId}`;

const assessmentSlice = createSlice({
  name: 'assessment',
  initialState,
  reducers: {
    clearAssessmentError(state) {
      state.error = null;
    },
    clearQuestionDetail(state) {
      state.questionDetail = null;
    },
    clearSubmitResult(state) {
      state.submitResult = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAssessmentSummaryThunk.pending, (state, action) => {
        state.loadingSummary = true;
        state.error = null;
        state.requestedSummaryFieldId = scopeKey(action.meta.arg);
      })
      .addCase(fetchAssessmentSummaryThunk.fulfilled, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedSummaryFieldId) return;
        state.loadingSummary = false;
        state.summary = action.payload;
        state.loadedSummaryScope = scopeKey(action.meta.arg);
      })
      .addCase(fetchAssessmentSummaryThunk.rejected, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedSummaryFieldId) return;
        state.loadingSummary = false;
        state.error = action.payload?.message ?? 'Failed to load assessment summary';
      })
      .addCase(refreshAssessmentSummaryThunk.pending, (state, action) => {
        state.refreshing = true;
        state.error = null;
        state.requestedSummaryFieldId = scopeKey(action.meta.arg);
      })
      .addCase(refreshAssessmentSummaryThunk.fulfilled, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedSummaryFieldId) return;
        state.refreshing = false;
        state.summary = action.payload;
        state.loadedSummaryScope = scopeKey(action.meta.arg);
      })
      .addCase(refreshAssessmentSummaryThunk.rejected, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedSummaryFieldId) return;
        state.refreshing = false;
        state.error = action.payload?.message ?? 'Failed to refresh assessment summary';
      })
      .addCase(fetchCategoryQuestionsThunk.pending, (state, action) => {
        state.loadingQuestions = true;
        state.error = null;
        state.requestedCategoryScope = categoryScopeKey(action.meta.arg);
      })
      .addCase(fetchCategoryQuestionsThunk.fulfilled, (state, action) => {
        if (categoryScopeKey(action.meta.arg) !== state.requestedCategoryScope) {
          return;
        }
        state.loadingQuestions = false;
        state.categoryQuestions = action.payload;
      })
      .addCase(fetchCategoryQuestionsThunk.rejected, (state, action) => {
        if (categoryScopeKey(action.meta.arg) !== state.requestedCategoryScope) {
          return;
        }
        state.loadingQuestions = false;
        state.error = action.payload?.message ?? 'Failed to load questions';
      })
      .addCase(fetchQuestionDetailThunk.pending, (state, action) => {
        state.loadingQuestion = true;
        state.error = null;
        state.requestedQuestionId = action.meta.arg.questionId;
        state.questionDetail = null;
      })
      .addCase(fetchQuestionDetailThunk.fulfilled, (state, action) => {
        if (action.payload.id !== state.requestedQuestionId) {
          return;
        }
        state.loadingQuestion = false;
        state.questionDetail = action.payload;
      })
      .addCase(fetchQuestionDetailThunk.rejected, (state, action) => {
        if (action.meta.arg.questionId !== state.requestedQuestionId) {
          return;
        }
        state.loadingQuestion = false;
        state.error = action.payload?.message ?? 'Failed to load question';
      })
      .addCase(saveAssessmentAnswerThunk.pending, state => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveAssessmentAnswerThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.answerVersion += 1;
        const saved = action.payload;
        const qId = saved.questionId;

        const listItem = state.categoryQuestions?.questions.find(q => q.id === qId);
        const previouslyAnswered =
          state.questionDetail?.id === qId
            ? state.questionDetail.answered
            : listItem?.answered ?? false;
        const isNewAnswer = !previouslyAnswered;

        if (state.questionDetail?.id === qId) {
          state.questionDetail.answerScore = saved.score;
          state.questionDetail.answerComment = saved.comment;
          state.questionDetail.answerEvidenceUrls = saved.evidenceUrls;
          state.questionDetail.answered = true;
        }

        if (listItem) {
          listItem.answered = true;
        }

        if (!isNewAnswer) {
          return;
        }

        const owningCategoryId = listItem ? state.categoryQuestions?.category.id : null;

        if (state.categoryQuestions && owningCategoryId) {
          const p = state.categoryQuestions.progress;
          p.answered = Math.min(p.answered + 1, p.totalQuestions);
          p.percentage = pct(p.answered, p.totalQuestions);
        }

        if (state.summary) {
          const info = state.summary.assessment;
          info.answered = Math.min(info.answered + 1, info.totalQuestions);
          info.percentage = pct(info.answered, info.totalQuestions);
          if (info.totalQuestions > 0 && info.answered >= info.totalQuestions) {
            info.status = 'COMPLETED';
          } else if (info.answered > 0) {
            info.status = 'IN_PROGRESS';
          }

          if (owningCategoryId) {
            const cat = state.summary.categories.find(c => c.id === owningCategoryId);
            if (cat) {
              cat.answered = Math.min(cat.answered + 1, cat.totalQuestions);
              cat.percentage = pct(cat.answered, cat.totalQuestions);
            }
          }
        }

        const { programId, fieldId } = action.meta.arg;
        const row = state.myFields?.fields.find(
          f => f.fieldId === fieldId && f.programId === programId,
        );
        if (row && row.status !== 'COMPLETED') {
          const wasNotStarted = row.answered === 0;
          row.answered = Math.min(row.answered + 1, row.totalQuestions);
          row.percentage = pct(row.answered, row.totalQuestions);
          row.status = 'IN_PROGRESS';

          if (wasNotStarted && state.myFields) {
            const counts = state.myFields.counts;
            counts.notStarted = Math.max(counts.notStarted - 1, 0);
            counts.inProgress += 1;
          }
        }
      })
      .addCase(saveAssessmentAnswerThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload?.message ?? 'Failed to save answer';
      })
      .addCase(fetchAssessmentReviewThunk.pending, (state, action) => {
        state.loadingReview = true;
        state.error = null;
        state.requestedReviewFieldId = scopeKey(action.meta.arg);
      })
      .addCase(fetchAssessmentReviewThunk.fulfilled, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedReviewFieldId) return;
        state.loadingReview = false;
        state.review = action.payload;
        state.loadedReviewScope = scopeKey(action.meta.arg);
      })
      .addCase(fetchAssessmentReviewThunk.rejected, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedReviewFieldId) return;
        state.loadingReview = false;
        state.error = action.payload?.message ?? 'Failed to load review';
      })
      .addCase(submitAssessmentThunk.pending, state => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(submitAssessmentThunk.fulfilled, (state, action) => {
        state.submitting = false;
        state.answerVersion += 1;
        state.submitResult = action.payload;
        if (state.summary) {
          state.summary.assessment.status = action.payload.status;
        }
        if (state.review) {
          state.review.submission.status = action.payload.status;
          state.review.submission.submittedAtISO = action.payload.submittedAtISO;
        }
      })
      .addCase(submitAssessmentThunk.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload?.message ?? 'Failed to submit assessment';
      })
      .addCase(discardAssessmentThunk.pending, state => {
        state.discarding = true;
        state.error = null;
      })
      .addCase(discardAssessmentThunk.fulfilled, (state, action) => {
        state.discarding = false;
        state.answerVersion += 1;
        const key = scopeKey(action.meta.arg);
        if (state.loadedSummaryScope === key) {
          state.summary = null;
          state.loadedSummaryScope = null;
        }
        if (state.loadedReviewScope === key) {
          state.review = null;
          state.loadedReviewScope = null;
        }
        if (state.loadedRegenScope === key) {
          state.regenIndex = null;
          state.loadedRegenScope = null;
        }
        state.categoryQuestions = null;
        state.requestedCategoryScope = null;
        state.questionDetail = null;
        state.submitResult = null;
      })
      .addCase(discardAssessmentThunk.rejected, (state, action) => {
        state.discarding = false;
        state.error = action.payload?.message ?? 'Failed to discard assessment';
      })
      .addCase(unenrollFieldThunk.fulfilled, (state, action) => {
        const { programId, fieldId } = action.payload;
        const key = `${programId}:${fieldId}`;
        if (state.myFields) {
          const before = state.myFields.fields.length;
          state.myFields.fields = state.myFields.fields.filter(f => rowKey(f) !== key);
          const removed = before - state.myFields.fields.length;
          if (removed > 0) {
            state.myFields.counts.total = Math.max(
              state.myFields.counts.total - removed,
              0,
            );
          }
        }
        if (state.myFieldsMeta && state.myFieldsMeta.total > 0) {
          state.myFieldsMeta.total -= 1;
        }
        if (state.loadedSummaryScope === key) {
          state.summary = null;
          state.loadedSummaryScope = null;
        }
        if (state.loadedRegenScope === key) {
          state.regenIndex = null;
          state.loadedRegenScope = null;
        }
      })
      .addCase(fetchMyAssessmentFieldsThunk.pending, (state, action) => {
        state.myFieldsSearch = argSearch(action.meta.arg);
        if ((action.meta.arg?.page ?? 1) > 1) {
          state.loadingMoreMyFields = true;
        } else {
          state.loadingMyFields = true;
        }
        state.error = null;
      })
      .addCase(fetchMyAssessmentFieldsThunk.fulfilled, (state, action) => {
        state.loadingMyFields = false;
        state.loadingMoreMyFields = false;
        if (argSearch(action.meta.arg) !== state.myFieldsSearch) {
          return;
        }
        const overview = action.payload;
        const page = overview.meta?.page ?? 1;
        state.myFields = {
          ...overview,
          fields: mergePage(state.myFields?.fields ?? null, overview.fields, page, rowKey),
        };
        state.myFieldsMeta = overview.meta ?? null;
      })
      .addCase(fetchMyAssessmentFieldsThunk.rejected, (state, action) => {
        state.loadingMyFields = false;
        state.loadingMoreMyFields = false;
        state.error = action.payload?.message ?? 'Failed to load assessments';
      })
      .addCase(fetchMyAssessmentHistoryThunk.pending, (state, action) => {
        state.myHistorySearch = argSearch(action.meta.arg);
        if ((action.meta.arg?.page ?? 1) > 1) {
          state.loadingMoreMyHistory = true;
        } else {
          state.loadingMyHistory = true;
        }
      })
      .addCase(fetchMyAssessmentHistoryThunk.fulfilled, (state, action) => {
        state.loadingMyHistory = false;
        state.loadingMoreMyHistory = false;
        if (argSearch(action.meta.arg) !== state.myHistorySearch) {
          return;
        }
        const { items, count, meta } = action.payload;
        state.myHistory = mergePage(state.myHistory, items, meta.page, rowKey);
        state.myHistoryCount = count;
        state.myHistoryMeta = meta;
      })
      .addCase(fetchMyAssessmentHistoryThunk.rejected, (state, action) => {
        state.loadingMyHistory = false;
        state.loadingMoreMyHistory = false;
        state.error = action.payload?.message ?? 'Failed to load assessment history';
      })
      .addCase(fetchFieldRegenIndexThunk.pending, (state, action) => {
        state.loadingRegenIndex = true;
        state.requestedRegenFieldId = scopeKey(action.meta.arg);
      })
      .addCase(fetchFieldRegenIndexThunk.fulfilled, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedRegenFieldId) return;
        state.loadingRegenIndex = false;
        state.regenIndex = action.payload;
        state.loadedRegenScope = scopeKey(action.meta.arg);
      })
      .addCase(fetchFieldRegenIndexThunk.rejected, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedRegenFieldId) return;
        state.loadingRegenIndex = false;
        state.regenIndex = null;
      })
      .addCase(logout, () => initialState);
  },
});

export const { clearAssessmentError, clearQuestionDetail, clearSubmitResult } =
  assessmentSlice.actions;
export default assessmentSlice.reducer;

export {
  fetchAssessmentSummaryThunk,
  refreshAssessmentSummaryThunk,
  fetchCategoryQuestionsThunk,
  fetchQuestionDetailThunk,
  saveAssessmentAnswerThunk,
  fetchAssessmentReviewThunk,
  submitAssessmentThunk,
  fetchMyAssessmentFieldsThunk,
  fetchMyAssessmentHistoryThunk,
  fetchFieldRegenIndexThunk,
  discardAssessmentThunk,
};

interface HasAssessment {
  assessment: AssessmentState;
}

const EMPTY_CATEGORIES: AssessmentCategorySummary[] = [];
const EMPTY_QUESTIONS: AssessmentQuestionListItem[] = [];

export const selectAssessmentSummary = (s: HasAssessment): FieldAssessmentSummary | null =>
  s.assessment.summary;

export const selectAssessmentCategories = (s: HasAssessment): AssessmentCategorySummary[] =>
  s.assessment.summary?.categories ?? EMPTY_CATEGORIES;

export const selectCategoryQuestionList = (s: HasAssessment): CategoryQuestionList | null =>
  s.assessment.categoryQuestions;

export const selectQuestionList = (s: HasAssessment): AssessmentQuestionListItem[] =>
  s.assessment.categoryQuestions?.questions ?? EMPTY_QUESTIONS;

export const selectQuestionDetail = (s: HasAssessment): AssessmentQuestionDetail | null =>
  s.assessment.questionDetail;

export const selectAssessmentReview = (s: HasAssessment): AssessmentReview | null =>
  s.assessment.review;
export const selectAssessmentSubmitResult = (s: HasAssessment): AssessmentSubmitResult | null =>
  s.assessment.submitResult;
export const selectMyAssessments = (s: HasAssessment): MyAssessmentsOverview | null =>
  s.assessment.myFields;

const EMPTY_HISTORY: MyAssessmentField[] = [];
export const selectMyHistory = (s: HasAssessment): MyAssessmentField[] =>
  s.assessment.myHistory ?? EMPTY_HISTORY;
export const selectMyHistoryRaw = (s: HasAssessment): MyAssessmentField[] | null =>
  s.assessment.myHistory;
export const selectMyHistoryCount = (s: HasAssessment): number => s.assessment.myHistoryCount;
export const selectMyHistoryLoading = (s: HasAssessment): boolean =>
  s.assessment.loadingMyHistory;

export const selectFieldRegenIndex = (s: HasAssessment): FieldRegenIndex | null =>
  s.assessment.regenIndex;
export const selectRegenIndexLoading = (s: HasAssessment): boolean =>
  s.assessment.loadingRegenIndex;

export const selectLoadedSummaryScope = (s: HasAssessment): string | null =>
  s.assessment.loadedSummaryScope;
export const selectLoadedReviewScope = (s: HasAssessment): string | null =>
  s.assessment.loadedReviewScope;
export const selectLoadedRegenScope = (s: HasAssessment): string | null =>
  s.assessment.loadedRegenScope;

export const selectAnswerVersion = (s: HasAssessment): number => s.assessment.answerVersion;

export const selectAssessmentSaving = (s: HasAssessment): boolean => s.assessment.saving;
export const selectAssessmentSubmitting = (s: HasAssessment): boolean => s.assessment.submitting;
export const selectAssessmentRefreshing = (s: HasAssessment): boolean => s.assessment.refreshing;
export const selectAssessmentError = (s: HasAssessment): string | null => s.assessment.error;

export const selectSummaryLoading = (s: HasAssessment): boolean => s.assessment.loadingSummary;
export const selectQuestionsLoading = (s: HasAssessment): boolean => s.assessment.loadingQuestions;
export const selectQuestionLoading = (s: HasAssessment): boolean => s.assessment.loadingQuestion;
export const selectReviewLoading = (s: HasAssessment): boolean => s.assessment.loadingReview;
export const selectAssessmentDiscarding = (s: HasAssessment): boolean =>
  s.assessment.discarding;
export const selectMyFieldsLoading = (s: HasAssessment): boolean => s.assessment.loadingMyFields;
export const selectMyFieldsLoadingMore = (s: HasAssessment): boolean =>
  s.assessment.loadingMoreMyFields;
export const selectMyFieldsHasMore = (s: HasAssessment): boolean =>
  hasNextPage(s.assessment.myFieldsMeta);
export const selectMyFieldsPage = (s: HasAssessment): number =>
  s.assessment.myFieldsMeta?.page ?? 1;
export const selectMyHistoryLoadingMore = (s: HasAssessment): boolean =>
  s.assessment.loadingMoreMyHistory;
export const selectMyHistoryHasMore = (s: HasAssessment): boolean =>
  hasNextPage(s.assessment.myHistoryMeta);
export const selectMyHistoryPage = (s: HasAssessment): number =>
  s.assessment.myHistoryMeta?.page ?? 1;
export const selectAssessmentLoading = (s: HasAssessment): boolean =>
  s.assessment.loadingSummary || s.assessment.loadingQuestions || s.assessment.loadingQuestion;
