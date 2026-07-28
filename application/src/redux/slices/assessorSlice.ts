import { createSelector, createSlice } from '@reduxjs/toolkit';
import type {
  AssessmentCategorySummary,
  AssessmentQuestionDetail,
  AssessmentQuestionListItem,
  CategoryQuestionList,
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
  fetchAssessorQuestionDetailThunk,
  saveAssessorAnswerThunk,
  submitAssessorAssessmentThunk,
  fetchFarmerAssessmentThunk,
  fetchComparisonThunk,
} from '../thunks/assessorThunks';

export interface AssessorState {
  fieldsOverview: AssessorFieldsOverview | null;
  fieldsRequestId: string | null;

  summary: FieldAssessmentSummary | null;
  requestedSummaryFieldId: string | null;
  loadedSummaryScope: string | null;
  locked: boolean;
  submittedBy: SubmittedBy | null;
  categoryQuestions: CategoryQuestionList | null;
  questionDetail: AssessmentQuestionDetail | null;
  requestedQuestionId: string | null;

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
  refreshing: boolean;
  saving: boolean;
  submitting: boolean;
  error: string | null;
}

const initialState: AssessorState = {
  fieldsOverview: null,
  fieldsRequestId: null,
  summary: null,
  requestedSummaryFieldId: null,
  loadedSummaryScope: null,
  locked: false,
  submittedBy: null,
  categoryQuestions: null,
  questionDetail: null,
  requestedQuestionId: null,
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
  refreshing: false,
  saving: false,
  submitting: false,
  error: null,
};

const pct = (answered: number, total: number): number =>
  total > 0 ? Math.round((answered / total) * 100) : 0;

const scopeKey = (arg: { programId: string; fieldId: string }): string =>
  `${arg.programId}:${arg.fieldId}`;

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
      .addCase(fetchAssessorCategoryQuestionsThunk.pending, state => {
        state.loadingQuestions = true;
        state.error = null;
      })
      .addCase(fetchAssessorCategoryQuestionsThunk.fulfilled, (state, action) => {
        state.loadingQuestions = false;
        state.categoryQuestions = action.payload;
      })
      .addCase(fetchAssessorCategoryQuestionsThunk.rejected, (state, action) => {
        state.loadingQuestions = false;
        state.error = action.payload?.message ?? 'Failed to load questions';
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
      .addCase(submitAssessorAssessmentThunk.pending, state => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(submitAssessorAssessmentThunk.fulfilled, (state, action) => {
        state.submitting = false;
        state.summary = action.payload.summary;
        state.locked = action.payload.locked;
        state.submittedBy = action.payload.submittedBy;
        if (state.questionDetail) {
          state.questionDetail.locked = true;
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
      .addCase(logout, () => initialState);
  },
});

export const { clearAssessorError, clearAssessorQuestionDetail } = assessorSlice.actions;
export default assessorSlice.reducer;

export {
  fetchAssessorFieldsThunk,
  fetchAssessorSummaryThunk,
  refreshAssessorSummaryThunk,
  fetchAssessorCategoryQuestionsThunk,
  fetchAssessorQuestionDetailThunk,
  saveAssessorAnswerThunk,
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
export const selectAssessorQuestionDetail = (s: HasAssessor): AssessmentQuestionDetail | null => s.assessor.questionDetail;
export const selectAssessorQuestionLoading = (s: HasAssessor): boolean => s.assessor.loadingQuestion;
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
