import { createSlice } from '@reduxjs/toolkit';
import type {
  AssessmentCategorySummary,
  AssessmentQuestionDetail,
  AssessmentQuestionListItem,
  AssessmentReview,
  AssessmentSubmitResult,
  CategoryQuestionList,
  FieldAssessmentSummary,
  MyAssessmentsOverview,
} from '../../types/assessment';
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
} from '../thunks/assessmentThunks';

export interface AssessmentState {
  summary: FieldAssessmentSummary | null;
  categoryQuestions: CategoryQuestionList | null;
  questionDetail: AssessmentQuestionDetail | null;
  requestedQuestionId: string | null;
  requestedSummaryFieldId: string | null;
  requestedReviewFieldId: string | null;
  review: AssessmentReview | null;
  submitResult: AssessmentSubmitResult | null;
  myFields: MyAssessmentsOverview | null;

  saving: boolean;
  loadingSummary: boolean;
  loadingQuestions: boolean;
  loadingQuestion: boolean;
  loadingReview: boolean;
  submitting: boolean;
  loadingMyFields: boolean;
  refreshing: boolean;
  error: string | null;
}

const initialState: AssessmentState = {
  summary: null,
  categoryQuestions: null,
  questionDetail: null,
  requestedQuestionId: null,
  requestedSummaryFieldId: null,
  requestedReviewFieldId: null,
  review: null,
  submitResult: null,
  myFields: null,
  saving: false,
  loadingSummary: false,
  loadingQuestions: false,
  loadingQuestion: false,
  loadingReview: false,
  submitting: false,
  loadingMyFields: false,
  refreshing: false,
  error: null,
};

const pct = (answered: number, total: number): number =>
  total > 0 ? Math.round((answered / total) * 100) : 0;

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
        state.requestedSummaryFieldId = action.meta.arg;
      })
      .addCase(fetchAssessmentSummaryThunk.fulfilled, (state, action) => {
        if (action.meta.arg !== state.requestedSummaryFieldId) return;
        state.loadingSummary = false;
        state.summary = action.payload;
      })
      .addCase(fetchAssessmentSummaryThunk.rejected, (state, action) => {
        if (action.meta.arg !== state.requestedSummaryFieldId) return;
        state.loadingSummary = false;
        state.error = action.payload?.message ?? 'Failed to load assessment summary';
      })
      .addCase(refreshAssessmentSummaryThunk.pending, (state, action) => {
        state.refreshing = true;
        state.error = null;
        state.requestedSummaryFieldId = action.meta.arg;
      })
      .addCase(refreshAssessmentSummaryThunk.fulfilled, (state, action) => {
        if (action.meta.arg !== state.requestedSummaryFieldId) return;
        state.refreshing = false;
        state.summary = action.payload;
      })
      .addCase(refreshAssessmentSummaryThunk.rejected, (state, action) => {
        if (action.meta.arg !== state.requestedSummaryFieldId) return;
        state.refreshing = false;
        state.error = action.payload?.message ?? 'Failed to refresh assessment summary';
      })
      .addCase(fetchCategoryQuestionsThunk.pending, state => {
        state.loadingQuestions = true;
        state.error = null;
      })
      .addCase(fetchCategoryQuestionsThunk.fulfilled, (state, action) => {
        state.loadingQuestions = false;
        state.categoryQuestions = action.payload;
      })
      .addCase(fetchCategoryQuestionsThunk.rejected, (state, action) => {
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

        if (state.categoryQuestions) {
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

          const categoryId = state.categoryQuestions?.category.id;
          if (categoryId) {
            const cat = state.summary.categories.find(c => c.id === categoryId);
            if (cat) {
              cat.answered = Math.min(cat.answered + 1, cat.totalQuestions);
              cat.percentage = pct(cat.answered, cat.totalQuestions);
            }
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
        state.review = null;
        state.requestedReviewFieldId = action.meta.arg;
      })
      .addCase(fetchAssessmentReviewThunk.fulfilled, (state, action) => {
        if (action.meta.arg !== state.requestedReviewFieldId) return;
        state.loadingReview = false;
        state.review = action.payload;
      })
      .addCase(fetchAssessmentReviewThunk.rejected, (state, action) => {
        if (action.meta.arg !== state.requestedReviewFieldId) return;
        state.loadingReview = false;
        state.error = action.payload?.message ?? 'Failed to load review';
      })
      .addCase(submitAssessmentThunk.pending, state => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(submitAssessmentThunk.fulfilled, (state, action) => {
        state.submitting = false;
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
      .addCase(fetchMyAssessmentFieldsThunk.pending, state => {
        state.loadingMyFields = true;
        state.error = null;
      })
      .addCase(fetchMyAssessmentFieldsThunk.fulfilled, (state, action) => {
        state.loadingMyFields = false;
        state.myFields = action.payload;
      })
      .addCase(fetchMyAssessmentFieldsThunk.rejected, (state, action) => {
        state.loadingMyFields = false;
        state.error = action.payload?.message ?? 'Failed to load assessments';
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

export const selectAssessmentSaving = (s: HasAssessment): boolean => s.assessment.saving;
export const selectAssessmentSubmitting = (s: HasAssessment): boolean => s.assessment.submitting;
export const selectAssessmentRefreshing = (s: HasAssessment): boolean => s.assessment.refreshing;
export const selectAssessmentError = (s: HasAssessment): string | null => s.assessment.error;

export const selectSummaryLoading = (s: HasAssessment): boolean => s.assessment.loadingSummary;
export const selectQuestionsLoading = (s: HasAssessment): boolean => s.assessment.loadingQuestions;
export const selectQuestionLoading = (s: HasAssessment): boolean => s.assessment.loadingQuestion;
export const selectReviewLoading = (s: HasAssessment): boolean => s.assessment.loadingReview;
export const selectMyFieldsLoading = (s: HasAssessment): boolean => s.assessment.loadingMyFields;
export const selectAssessmentLoading = (s: HasAssessment): boolean =>
  s.assessment.loadingSummary || s.assessment.loadingQuestions || s.assessment.loadingQuestion;
