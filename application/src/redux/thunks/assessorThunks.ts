import { createAsyncThunk } from '@reduxjs/toolkit';
import * as assessorApi from '../../api/assessorApi';
import type {
  CategoryQuestionList,
  AssessmentQuestionDetail,
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
  fieldId: string,
  root: RootLike,
): AssessorAssessmentSummary => {
  const entry = root.assessor.fieldsOverview?.fields.find(e => e.field.id === fieldId);
  const field = entry
    ? { ...base.summary.field, farmId: entry.farm.id, farmName: entry.farm.name }
    : base.summary.field;
  const locked = entry?.assessment.completed ?? false;
  return {
    summary: { ...base.summary, field },
    locked,
    submittedBy: locked ? assessorStamp(root.auth.user) : null,
  };
};

export interface AssessorSubmitResult extends AssessorAssessmentSummary {
  submittedAtISO: string;
  scorePercentage: number;
}

export interface CategoryQuestionsArg {
  fieldId: string;
  categoryId: string;
}
export interface QuestionDetailArg {
  fieldId: string;
  categoryId: string;
  questionId: string;
}
export interface SaveAnswerArg {
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

export const fetchAssessorSummaryThunk = createAsyncThunk<AssessorAssessmentSummary, string, ThunkConfig>(
  'assessor/fetchSummary',
  async (fieldId, { getState, rejectWithValue }) => {
    try {
      const base = await assessorApi.getSummary(fieldId);
      return enrichSummary(base, fieldId, getState() as RootLike);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const refreshAssessorSummaryThunk = createAsyncThunk<AssessorAssessmentSummary, string, ThunkConfig>(
  'assessor/refreshSummary',
  async (fieldId, { getState, rejectWithValue }) => {
    try {
      const base = await assessorApi.getSummary(fieldId);
      return enrichSummary(base, fieldId, getState() as RootLike);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchAssessorCategoryQuestionsThunk = createAsyncThunk<
  CategoryQuestionList,
  CategoryQuestionsArg,
  ThunkConfig
>('assessor/fetchCategoryQuestions', async ({ fieldId, categoryId }, { rejectWithValue }) => {
  try {
    return await assessorApi.getCategoryQuestions(fieldId, categoryId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchAssessorQuestionDetailThunk = createAsyncThunk<
  AssessmentQuestionDetail,
  QuestionDetailArg,
  ThunkConfig
>('assessor/fetchQuestionDetail', async ({ fieldId, categoryId, questionId }, { rejectWithValue }) => {
  try {
    return await assessorApi.getQuestion(fieldId, categoryId, questionId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const saveAssessorAnswerThunk = createAsyncThunk<SavedAnswer, SaveAnswerArg, ThunkConfig>(
  'assessor/saveAnswer',
  async ({ fieldId, questionId, input }, { rejectWithValue }) => {
    try {
      return await assessorApi.saveAnswer(fieldId, questionId, input);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const submitAssessorAssessmentThunk = createAsyncThunk<AssessorSubmitResult, string, ThunkConfig>(
  'assessor/submit',
  async (fieldId, { getState, rejectWithValue }) => {
    try {
      const result = await assessorApi.submit(fieldId);
      const root = getState() as RootLike;
      const current = root.assessor.summary;
      const totalQuestions = result.totalQuestions || current?.assessment.totalQuestions || 0;
      const base: FieldAssessmentSummary =
        current && current.field.id === fieldId
          ? current
          : {
              field: { id: result.field.id, name: result.field.name, farmId: '', farmName: '' },
              assessment: { title: '', year: 0, status: 'COMPLETED', totalQuestions, answered: totalQuestions, percentage: 100 },
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
        },
      };
      return {
        summary,
        locked: true,
        submittedBy: assessorStamp(root.auth.user),
        submittedAtISO: result.submittedAtISO,
        scorePercentage: result.percentage,
      };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (_fieldId, { getState }) =>
      !(getState() as { assessor: { submitting: boolean } }).assessor.submitting,
  },
);

export const fetchFarmerAssessmentThunk = createAsyncThunk<FarmerAssessmentView, string, ThunkConfig>(
  'assessor/fetchFarmerAssessment',
  async (fieldId, { rejectWithValue }) => {
    try {
      return await assessorApi.getFarmerAssessment(fieldId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchComparisonThunk = createAsyncThunk<AssessorComparison, string, ThunkConfig>(
  'assessor/fetchComparison',
  async (fieldId, { rejectWithValue }) => {
    try {
      return await assessorApi.getComparison(fieldId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);
