import { createSelector, createSlice, isAnyOf } from '@reduxjs/toolkit';
import type {
  AssessmentCategorySummary,
  AssessmentQuestionDetail,
  AssessmentQuestionListItem,
  AssessmentReview,
  AssessmentSubmitResult,
  CategoryQuestionList,
  CategoryQuestionSet,
  FieldAssessmentSummary,
} from '../../types/assessment';
import type {
  AssessorComparison,
  AssessorDashboard,
  AssessorFieldsOverview,
  AssessorHistoryGroup,
  AssignedFarmer,
  FarmerAssessmentView,
  SubmittedBy,
} from '../../types/assessor';
import { logout } from './authSlice';
import {
  deriveAssignedFarmers,
  deriveDashboard,
  deriveHistoryGroups,
} from '../derive/assessorDerive';
import {
  fetchAssessorFieldsThunk,
  fetchAssessorSummaryThunk,
  refreshAssessorSummaryThunk,
  fetchAssessorCategoryQuestionsThunk,
  fetchAssessorCategoryFormThunk,
  saveAssessorCategoryAnswersThunk,
  addAssessorCategoryRecordThunk,
  saveAssessorCategoryRecordThunk,
  deleteAssessorCategoryRecordThunk,
  fetchAssessorQuestionDetailThunk,
  saveAssessorAnswerThunk,
  fetchAssessorReviewThunk,
  submitAssessorAssessmentThunk,
  fetchFarmerAssessmentThunk,
  fetchComparisonThunk,
} from '../thunks/assessorThunks';

export interface AssessorState {
  fieldsOverview: AssessorFieldsOverview | null;
  fieldsRequestId: string | null;
  fieldsCapturedAt: string | null;

  summary: FieldAssessmentSummary | null;
  requestedSummaryFieldId: string | null;
  loadedSummaryScope: string | null;
  locked: boolean;
  submittedBy: SubmittedBy | null;
  categoryQuestions: CategoryQuestionList | null;
  requestedCategoryScope: string | null;
  categoryForm: CategoryQuestionSet | null;
  requestedCategoryFormScope: string | null;
  loadingCategoryForm: boolean;
  savingCategoryForm: boolean;
  questionDetail: AssessmentQuestionDetail | null;
  requestedQuestionId: string | null;
  review: AssessmentReview | null;
  requestedReviewScope: string | null;
  loadedReviewScope: string | null;
  submitResult: AssessmentSubmitResult | null;
  answerVersion: number;

  farmerAssessment: FarmerAssessmentView | null;
  farmerAssessmentRequestId: string | null;
  comparison: AssessorComparison | null;
  comparisonRequestId: string | null;

  loadingFieldsOverview: boolean;
  loadingFarmerAssessment: boolean;
  loadingComparison: boolean;
  loadingSummary: boolean;
  loadingQuestions: boolean;
  loadingQuestion: boolean;
  loadingReview: boolean;
  refreshing: boolean;
  saving: boolean;
  submitting: boolean;
  error: string | null;
}

const initialState: AssessorState = {
  fieldsOverview: null,
  fieldsCapturedAt: null,
  fieldsRequestId: null,
  summary: null,
  requestedSummaryFieldId: null,
  loadedSummaryScope: null,
  locked: false,
  submittedBy: null,
  categoryQuestions: null,
  requestedCategoryScope: null,
  categoryForm: null,
  requestedCategoryFormScope: null,
  loadingCategoryForm: false,
  savingCategoryForm: false,
  questionDetail: null,
  requestedQuestionId: null,
  review: null,
  requestedReviewScope: null,
  loadedReviewScope: null,
  submitResult: null,
  answerVersion: 0,
  farmerAssessment: null,
  farmerAssessmentRequestId: null,
  comparison: null,
  comparisonRequestId: null,
  loadingFieldsOverview: false,
  loadingFarmerAssessment: false,
  loadingComparison: false,
  loadingSummary: false,
  loadingQuestions: false,
  loadingQuestion: false,
  loadingReview: false,
  refreshing: false,
  saving: false,
  submitting: false,
  error: null,
};

const pct = (answered: number, total: number): number =>
  total > 0 ? Math.round((answered / total) * 100) : 0;

const scopeKey = (arg: { programId: string; fieldId: string }): string =>
  `${arg.programId}:${arg.fieldId}`;

const categoryScopeKey = (arg: {
  programId: string;
  fieldId: string;
  categoryId: string;
}): string => `${arg.programId}:${arg.fieldId}:${arg.categoryId}`;

const assessorSlice = createSlice({
  name: 'assessor',
  initialState,
  reducers: {
    clearAssessorError(state) {
      state.error = null;
    },
    clearAssessorQuestionDetail(state) {
      state.questionDetail = null;
    },
    clearAssessorSubmitResult(state) {
      state.submitResult = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAssessorFieldsThunk.pending, (state, action) => {
        state.loadingFieldsOverview = true;
        state.error = null;
        state.fieldsRequestId = action.meta.requestId;
      })
      .addCase(fetchAssessorFieldsThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.fieldsRequestId) {
          return;
        }
        state.loadingFieldsOverview = false;
        state.fieldsOverview = action.payload;
        state.fieldsCapturedAt = action.meta.capturedAt ?? null;
      })
      .addCase(fetchAssessorFieldsThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.fieldsRequestId) {
          return;
        }
        state.loadingFieldsOverview = false;
        state.error = action.payload?.message ?? 'Failed to load fields';
      })
      .addCase(fetchAssessorSummaryThunk.pending, (state, action) => {
        state.loadingSummary = true;
        state.error = null;
        state.requestedSummaryFieldId = scopeKey(action.meta.arg);
      })
      .addCase(fetchAssessorSummaryThunk.fulfilled, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedSummaryFieldId) {
          return;
        }
        state.loadingSummary = false;
        state.summary = action.payload.summary;
        state.locked = action.payload.locked;
        state.submittedBy = action.payload.submittedBy;
        state.loadedSummaryScope = scopeKey(action.meta.arg);
      })
      .addCase(fetchAssessorSummaryThunk.rejected, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedSummaryFieldId) {
          return;
        }
        state.loadingSummary = false;
        state.error = action.payload?.message ?? 'Failed to load assessment';
      })
      .addCase(refreshAssessorSummaryThunk.pending, (state, action) => {
        state.refreshing = true;
        state.error = null;
        state.requestedSummaryFieldId = scopeKey(action.meta.arg);
      })
      .addCase(refreshAssessorSummaryThunk.fulfilled, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedSummaryFieldId) {
          return;
        }
        state.refreshing = false;
        state.summary = action.payload.summary;
        state.locked = action.payload.locked;
        state.submittedBy = action.payload.submittedBy;
        state.loadedSummaryScope = scopeKey(action.meta.arg);
      })
      .addCase(refreshAssessorSummaryThunk.rejected, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedSummaryFieldId) {
          return;
        }
        state.refreshing = false;
        state.error = action.payload?.message ?? 'Failed to refresh assessment';
      })
      .addCase(fetchAssessorCategoryQuestionsThunk.pending, (state, action) => {
        state.loadingQuestions = true;
        state.error = null;
        state.requestedCategoryScope = categoryScopeKey(action.meta.arg);
      })
      .addCase(fetchAssessorCategoryQuestionsThunk.fulfilled, (state, action) => {
        if (categoryScopeKey(action.meta.arg) !== state.requestedCategoryScope) {
          return;
        }
        state.loadingQuestions = false;
        state.categoryQuestions = action.payload;
      })
      .addCase(fetchAssessorCategoryQuestionsThunk.rejected, (state, action) => {
        if (categoryScopeKey(action.meta.arg) !== state.requestedCategoryScope) {
          return;
        }
        state.loadingQuestions = false;
        state.error = action.payload?.message ?? 'Failed to load questions';
      })
      .addCase(fetchAssessorCategoryFormThunk.pending, (state, action) => {
        state.loadingCategoryForm = true;
        state.error = null;
        state.requestedCategoryFormScope = categoryScopeKey(action.meta.arg);
      })
      .addCase(fetchAssessorCategoryFormThunk.fulfilled, (state, action) => {
        if (categoryScopeKey(action.meta.arg) !== state.requestedCategoryFormScope) {
          return;
        }
        state.loadingCategoryForm = false;
        state.categoryForm = action.payload;
      })
      .addCase(fetchAssessorCategoryFormThunk.rejected, (state, action) => {
        if (categoryScopeKey(action.meta.arg) !== state.requestedCategoryFormScope) {
          return;
        }
        state.loadingCategoryForm = false;
        state.error = action.payload?.message ?? 'Failed to load the form';
      })
      .addCase(saveAssessorCategoryAnswersThunk.pending, state => {
        state.savingCategoryForm = true;
        state.error = null;
      })
      .addCase(saveAssessorCategoryAnswersThunk.fulfilled, (state, action) => {
        state.savingCategoryForm = false;
        state.answerVersion += 1;
        state.categoryForm = action.payload;
      })
      .addCase(saveAssessorCategoryAnswersThunk.rejected, (state, action) => {
        state.savingCategoryForm = false;
        state.error = action.payload?.message ?? 'Failed to save the form';
      })
      .addCase(fetchAssessorQuestionDetailThunk.pending, (state, action) => {
        state.loadingQuestion = true;
        state.error = null;
        state.questionDetail = null;
        state.requestedQuestionId = action.meta.arg.questionId;
      })
      .addCase(fetchAssessorQuestionDetailThunk.fulfilled, (state, action) => {
        if (action.payload.id !== state.requestedQuestionId) {
          return;
        }
        state.loadingQuestion = false;
        state.questionDetail = action.payload;
        if (action.payload.locked && state.loadedSummaryScope === scopeKey(action.meta.arg)) {
          state.locked = true;
          if (state.summary) {
            state.summary.assessment.submitted = true;
          }
        }
      })
      .addCase(fetchAssessorQuestionDetailThunk.rejected, (state, action) => {
        if (action.meta.arg.questionId !== state.requestedQuestionId) {
          return;
        }
        state.loadingQuestion = false;
        state.error = action.payload?.message ?? 'Failed to load question';
      })
      .addCase(saveAssessorAnswerThunk.pending, state => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveAssessorAnswerThunk.fulfilled, (state, action) => {
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
          const qd = state.questionDetail;
          qd.answerScore = saved.score;
          qd.answerOptionId = saved.optionId;
          qd.answerText = saved.answerText;
          qd.answerNumber = saved.answerNumber;
          qd.answerDate = saved.answerDate;
          qd.answerBoolean = saved.answerBoolean;
          qd.answerComment = saved.comment;
          qd.answerEvidenceUrls = saved.evidenceUrls;
          qd.answered = true;
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
        if (state.fieldsOverview) {
          const { programId, fieldId } = action.meta.arg;
          const entry = state.fieldsOverview.fields.find(
            e => e.field.id === fieldId && e.program.id === programId,
          );
          if (entry && !entry.assessment.completed) {
            const a = entry.assessment;
            a.answered = Math.min(a.answered + 1, a.totalQuestions);
            a.percentage = pct(a.answered, a.totalQuestions);
            a.status = 'IN_PROGRESS';
            a.inProgress = true;
          }
        }
      })
      .addCase(saveAssessorAnswerThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload?.message ?? 'Failed to save answer';
      })
      .addCase(fetchAssessorReviewThunk.pending, (state, action) => {
        state.loadingReview = true;
        state.error = null;
        state.requestedReviewScope = scopeKey(action.meta.arg);
      })
      .addCase(fetchAssessorReviewThunk.fulfilled, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedReviewScope) {
          return;
        }
        state.loadingReview = false;
        state.review = action.payload.review;
        state.loadedReviewScope = scopeKey(action.meta.arg);
        if (
          action.payload.review.submission.submittedAtISO &&
          state.loadedSummaryScope === scopeKey(action.meta.arg)
        ) {
          state.locked = true;
          state.submittedBy = action.payload.submittedBy ?? state.submittedBy;
          if (state.summary) {
            state.summary.assessment.submitted = true;
          }
        }
      })
      .addCase(fetchAssessorReviewThunk.rejected, (state, action) => {
        if (scopeKey(action.meta.arg) !== state.requestedReviewScope) {
          return;
        }
        state.loadingReview = false;
        state.error = action.payload?.message ?? 'Failed to load review';
      })
      .addCase(submitAssessorAssessmentThunk.pending, state => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(submitAssessorAssessmentThunk.fulfilled, (state, action) => {
        state.submitting = false;
        state.answerVersion += 1;
        state.summary = action.payload.summary;
        state.locked = action.payload.locked;
        state.submittedBy = action.payload.submittedBy;
        state.submitResult = action.payload.result;
        if (state.questionDetail) {
          state.questionDetail.locked = true;
        }
        if (state.review) {
          state.review.submission.status = action.payload.result.status;
          state.review.submission.submittedAtISO = action.payload.submittedAtISO;
          state.review.submission.reviewStatus = action.payload.result.reviewStatus;
          state.review.submission.reviewNote = action.payload.result.reviewNote;
        }
        if (state.fieldsOverview) {
          const { programId, fieldId } = action.meta.arg;
          const entry = state.fieldsOverview.fields.find(
            e => e.field.id === fieldId && e.program.id === programId,
          );
          if (entry) {
            const a = entry.assessment;
            a.completed = true;
            a.inProgress = false;
            a.status = 'COMPLETED';
            a.answered = action.payload.summary.assessment.answered;
            a.percentage = action.payload.scorePercentage;
            a.submittedAtISO = action.payload.submittedAtISO;
          }
        }
      })
      .addCase(submitAssessorAssessmentThunk.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload?.message ?? 'Failed to submit assessment';
      })
      .addCase(fetchFarmerAssessmentThunk.pending, (state, action) => {
        state.loadingFarmerAssessment = true;
        state.error = null;
        state.farmerAssessmentRequestId = action.meta.requestId;
      })
      .addCase(fetchFarmerAssessmentThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.farmerAssessmentRequestId) {
          return;
        }
        state.loadingFarmerAssessment = false;
        state.farmerAssessment = action.payload;
      })
      .addCase(fetchFarmerAssessmentThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.farmerAssessmentRequestId) {
          return;
        }
        state.loadingFarmerAssessment = false;
        state.error = action.payload?.message ?? "Failed to load the farmer's assessment";
      })
      .addCase(fetchComparisonThunk.pending, (state, action) => {
        state.loadingComparison = true;
        state.error = null;
        state.comparisonRequestId = action.meta.requestId;
      })
      .addCase(fetchComparisonThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.comparisonRequestId) {
          return;
        }
        state.loadingComparison = false;
        state.comparison = action.payload;
      })
      .addCase(fetchComparisonThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.comparisonRequestId) {
          return;
        }
        state.loadingComparison = false;
        state.error = action.payload?.message ?? 'Failed to load the comparison';
      })
      .addCase(logout, () => initialState)
      .addMatcher(
        isAnyOf(
          addAssessorCategoryRecordThunk.pending,
          saveAssessorCategoryRecordThunk.pending,
          deleteAssessorCategoryRecordThunk.pending,
        ),
        state => {
          state.savingCategoryForm = true;
          state.error = null;
        },
      )
      .addMatcher(
        isAnyOf(
          addAssessorCategoryRecordThunk.fulfilled,
          saveAssessorCategoryRecordThunk.fulfilled,
          deleteAssessorCategoryRecordThunk.fulfilled,
        ),
        (state, action) => {
          state.savingCategoryForm = false;
          state.answerVersion += 1;
          state.categoryForm = action.payload;
        },
      )
      .addMatcher(
        isAnyOf(
          addAssessorCategoryRecordThunk.rejected,
          saveAssessorCategoryRecordThunk.rejected,
          deleteAssessorCategoryRecordThunk.rejected,
        ),
        (state, action) => {
          state.savingCategoryForm = false;
          state.error = action.payload?.message ?? 'Failed to save the form';
        },
      );
  },
});

export const {
  clearAssessorError,
  clearAssessorQuestionDetail,
  clearAssessorSubmitResult,
} = assessorSlice.actions;
export default assessorSlice.reducer;

export {
  fetchAssessorFieldsThunk,
  fetchAssessorSummaryThunk,
  refreshAssessorSummaryThunk,
  fetchAssessorCategoryQuestionsThunk,
  fetchAssessorCategoryFormThunk,
  saveAssessorCategoryAnswersThunk,
  addAssessorCategoryRecordThunk,
  saveAssessorCategoryRecordThunk,
  deleteAssessorCategoryRecordThunk,
  fetchAssessorQuestionDetailThunk,
  saveAssessorAnswerThunk,
  fetchAssessorReviewThunk,
  submitAssessorAssessmentThunk,
  fetchFarmerAssessmentThunk,
  fetchComparisonThunk,
};

interface HasAssessor {
  assessor: AssessorState;
}

const EMPTY_FARMERS: AssignedFarmer[] = [];
const EMPTY_HISTORY: AssessorHistoryGroup[] = [];
const EMPTY_CATEGORIES: AssessmentCategorySummary[] = [];
const EMPTY_QUESTIONS: AssessmentQuestionListItem[] = [];

export const selectAssessorFieldsOverview = (s: HasAssessor): AssessorFieldsOverview | null =>
  s.assessor.fieldsOverview;
export const selectAssessorFieldsCapturedAt = (s: HasAssessor): string | null =>
  s.assessor.fieldsCapturedAt;
export const selectAssessorFieldsOverviewLoading = (s: HasAssessor): boolean =>
  s.assessor.loadingFieldsOverview;

export const selectAssessorDashboard = createSelector(
  [selectAssessorFieldsOverview],
  (overview): AssessorDashboard | null => (overview ? deriveDashboard(overview) : null),
);
export const selectAssessorDashboardLoading = (s: HasAssessor): boolean =>
  s.assessor.loadingFieldsOverview;
export const selectAssignedFarmers = createSelector(
  [selectAssessorFieldsOverview],
  (overview): AssignedFarmer[] => (overview ? deriveAssignedFarmers(overview) : EMPTY_FARMERS),
);
export const selectAssignedFarmersLoading = (s: HasAssessor): boolean =>
  s.assessor.loadingFieldsOverview;
export const selectAssessorHistory = createSelector(
  [selectAssessorFieldsOverview],
  (overview): AssessorHistoryGroup[] => (overview ? deriveHistoryGroups(overview) : EMPTY_HISTORY),
);
export const selectAssessorHistoryLoading = (s: HasAssessor): boolean =>
  s.assessor.loadingFieldsOverview;

export const selectAssessorSummary = (s: HasAssessor): FieldAssessmentSummary | null => s.assessor.summary;
export const selectAssessorLoadedSummaryScope = (s: HasAssessor): string | null =>
  s.assessor.loadedSummaryScope;
export const selectAssessorCategories = (s: HasAssessor): AssessmentCategorySummary[] => s.assessor.summary?.categories ?? EMPTY_CATEGORIES;
export const selectAssessorLocked = (s: HasAssessor): boolean => s.assessor.locked;
export const selectAssessorSubmittedBy = (s: HasAssessor): SubmittedBy | null => s.assessor.submittedBy;
export const selectAssessorSummaryLoading = (s: HasAssessor): boolean => s.assessor.loadingSummary;
export const selectAssessorRefreshing = (s: HasAssessor): boolean => s.assessor.refreshing;
export const selectAssessorCategoryQuestionList = (s: HasAssessor): CategoryQuestionList | null => s.assessor.categoryQuestions;
export const selectAssessorQuestionList = (s: HasAssessor): AssessmentQuestionListItem[] => s.assessor.categoryQuestions?.questions ?? EMPTY_QUESTIONS;
export const selectAssessorQuestionsLoading = (s: HasAssessor): boolean => s.assessor.loadingQuestions;
export const selectAssessorCategoryForm = (s: HasAssessor): CategoryQuestionSet | null => s.assessor.categoryForm;
export const selectAssessorCategoryFormLoading = (s: HasAssessor): boolean => s.assessor.loadingCategoryForm;
export const selectAssessorCategoryFormSaving = (s: HasAssessor): boolean => s.assessor.savingCategoryForm;
export const selectAssessorQuestionDetail = (s: HasAssessor): AssessmentQuestionDetail | null => s.assessor.questionDetail;
export const selectAssessorQuestionLoading = (s: HasAssessor): boolean => s.assessor.loadingQuestion;
export const selectAssessorReview = (s: HasAssessor): AssessmentReview | null =>
  s.assessor.review;
export const selectAssessorReviewLoading = (s: HasAssessor): boolean => s.assessor.loadingReview;
export const selectAssessorLoadedReviewScope = (s: HasAssessor): string | null =>
  s.assessor.loadedReviewScope;
export const selectAssessorSubmitResult = (s: HasAssessor): AssessmentSubmitResult | null =>
  s.assessor.submitResult;
export const selectAssessorAnswerVersion = (s: HasAssessor): number => s.assessor.answerVersion;
export const selectAssessorSaving = (s: HasAssessor): boolean => s.assessor.saving;
export const selectAssessorSubmitting = (s: HasAssessor): boolean => s.assessor.submitting;
export const selectAssessorError = (s: HasAssessor): string | null => s.assessor.error;

export const selectAssessorFarmerAssessment = (s: HasAssessor): FarmerAssessmentView | null =>
  s.assessor.farmerAssessment;
export const selectAssessorFarmerAssessmentLoading = (s: HasAssessor): boolean =>
  s.assessor.loadingFarmerAssessment;
export const selectAssessorComparison = (s: HasAssessor): AssessorComparison | null =>
  s.assessor.comparison;
export const selectAssessorComparisonLoading = (s: HasAssessor): boolean =>
  s.assessor.loadingComparison;
