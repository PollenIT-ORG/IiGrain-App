import { createAsyncThunk } from '@reduxjs/toolkit';
import * as assessorApi from '../../api/assessorApi';
import type {
  CategoryQuestionList,
  AssessmentQuestionDetail,
  AssessmentReview,
  AssessmentSubmitResult,
  FieldAssessmentSummary,
  SaveAnswerInput,
  SavedAnswer,
} from '../../types/assessment';
import type {
  AssessorAssessmentSummary,
  AssessorComparison,
  AssessorFieldsOverview,
  FarmerAssessmentView,
  SubmittedBy,
} from '../../types/assessor';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

type ThunkConfig = { rejectValue: StandardizedError };

interface RootLike {
  assessor: {
    fieldsOverview: AssessorFieldsOverview | null;
    summary: FieldAssessmentSummary | null;
  };
  auth: { user: { id: string; fullName: string } | null };
}

const assessorStamp = (user: RootLike['auth']['user']): SubmittedBy => ({
  id: user?.id ?? '',
  name: user?.fullName ?? '',
  role: 'assessor',
});

const enrichSummary = (
  base: AssessorAssessmentSummary,
  programId: string,
  fieldId: string,
  root: RootLike,
): AssessorAssessmentSummary => {
  const entry = root.assessor.fieldsOverview?.fields.find(
    e => e.field.id === fieldId && e.program.id === programId,
  );
  const field = entry
    ? { ...base.summary.field, farmId: entry.farm.id, farmName: entry.farm.name }
    : base.summary.field;
  const locked = entry?.assessment.completed ?? false;
  return {
    summary: {
      ...base.summary,
      field,
      assessment: {
        ...base.summary.assessment,
        submitted: locked || base.summary.assessment.submitted,
      },
    },
    locked,
    submittedBy: locked ? assessorStamp(root.auth.user) : null,
  };
};

export interface AssessorSubmitResult extends AssessorAssessmentSummary {
  submittedAtISO: string;
  scorePercentage: number;
  result: AssessmentSubmitResult;
}

export interface AssessorReviewResult {
  review: AssessmentReview;
  submittedBy: SubmittedBy | null;
}

export interface FieldScopeArg {
  programId: string;
  fieldId: string;
}
export interface CategoryQuestionsArg {
  programId: string;
  fieldId: string;
  categoryId: string;
}
export interface QuestionDetailArg {
  programId: string;
  fieldId: string;
  categoryId: string;
  questionId: string;
}
export interface SaveAnswerArg {
  programId: string;
  fieldId: string;
  questionId: string;
  input: SaveAnswerInput;
}

export const fetchAssessorFieldsThunk = createAsyncThunk<
  AssessorFieldsOverview,
  void,
  ThunkConfig
>(
  'assessor/fetchFields',
  async (_, { rejectWithValue }) => {
    try {
      return await assessorApi.getFields();
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (_arg, { getState }) =>
      !(getState() as { assessor: { loadingFieldsOverview: boolean } }).assessor
        .loadingFieldsOverview,
  },
);

export const fetchAssessorSummaryThunk = createAsyncThunk<AssessorAssessmentSummary, FieldScopeArg, ThunkConfig>(
  'assessor/fetchSummary',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    try {
      const base = await assessorApi.getSummary(programId, fieldId);
      return enrichSummary(base, programId, fieldId, getState() as RootLike);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const refreshAssessorSummaryThunk = createAsyncThunk<AssessorAssessmentSummary, FieldScopeArg, ThunkConfig>(
  'assessor/refreshSummary',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    try {
      const base = await assessorApi.getSummary(programId, fieldId);
      return enrichSummary(base, programId, fieldId, getState() as RootLike);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchAssessorCategoryQuestionsThunk = createAsyncThunk<
  CategoryQuestionList,
  CategoryQuestionsArg,
  ThunkConfig
>('assessor/fetchCategoryQuestions', async ({ programId, fieldId, categoryId }, { rejectWithValue }) => {
  try {
    return await assessorApi.getCategoryQuestions(programId, fieldId, categoryId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchAssessorQuestionDetailThunk = createAsyncThunk<
  AssessmentQuestionDetail,
  QuestionDetailArg,
  ThunkConfig
>('assessor/fetchQuestionDetail', async ({ programId, fieldId, categoryId, questionId }, { rejectWithValue }) => {
  try {
    return await assessorApi.getQuestion(programId, fieldId, categoryId, questionId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const saveAssessorAnswerThunk = createAsyncThunk<SavedAnswer, SaveAnswerArg, ThunkConfig>(
  'assessor/saveAnswer',
  async ({ programId, fieldId, questionId, input }, { rejectWithValue }) => {
    try {
      return await assessorApi.saveAnswer(programId, fieldId, questionId, input);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchAssessorReviewThunk = createAsyncThunk<
  AssessorReviewResult,
  FieldScopeArg,
  ThunkConfig
>('assessor/fetchReview', async ({ programId, fieldId }, { getState, rejectWithValue }) => {
  try {
    const review = await assessorApi.getReview(programId, fieldId);
    const root = getState() as RootLike;
    return {
      review,
      submittedBy: review.submission.submittedAtISO ? assessorStamp(root.auth.user) : null,
    };
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const submitAssessorAssessmentThunk = createAsyncThunk<AssessorSubmitResult, FieldScopeArg, ThunkConfig>(
  'assessor/submit',
  async ({ programId, fieldId }, { getState, rejectWithValue }) => {
    try {
      const result = await assessorApi.submit(programId, fieldId);
      const root = getState() as RootLike;
      const current = root.assessor.summary;
      const totalQuestions = result.totalQuestions || current?.assessment.totalQuestions || 0;
      const base: FieldAssessmentSummary =
        current && current.field.id === fieldId
          ? current
          : {
              field: { id: result.field.id, name: result.field.name, farmId: '', farmName: '' },
              assessment: { title: '', year: 0, status: 'COMPLETED', totalQuestions, answered: totalQuestions, percentage: 100, submitted: true },
              categories: [],
            };
      const summary: FieldAssessmentSummary = {
        ...base,
        assessment: {
          ...base.assessment,
          status: 'COMPLETED',
          totalQuestions,
          answered: totalQuestions,
          percentage: 100,
          submitted: true,
        },
      };
      return {
        summary,
        locked: true,
        submittedBy: assessorStamp(root.auth.user),
        submittedAtISO: result.submittedAtISO,
        scorePercentage: result.percentage,
        result,
      };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (_arg, { getState }) =>
      !(getState() as { assessor: { submitting: boolean } }).assessor.submitting,
  },
);

export const fetchFarmerAssessmentThunk = createAsyncThunk<FarmerAssessmentView, FieldScopeArg, ThunkConfig>(
  'assessor/fetchFarmerAssessment',
  async ({ programId, fieldId }, { rejectWithValue }) => {
    try {
      return await assessorApi.getFarmerAssessment(programId, fieldId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchComparisonThunk = createAsyncThunk<AssessorComparison, FieldScopeArg, ThunkConfig>(
  'assessor/fetchComparison',
  async ({ programId, fieldId }, { rejectWithValue }) => {
    try {
      return await assessorApi.getComparison(programId, fieldId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);
