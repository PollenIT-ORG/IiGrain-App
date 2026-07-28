import { createAsyncThunk } from '@reduxjs/toolkit';
import * as assessmentApi from '../../api/assessmentApi';
import type {
  AssessmentQuestionDetail,
  AssessmentReview,
  AssessmentSubmitResult,
  CategoryQuestionList,
  FieldAssessmentSummary,
  FieldRegenIndex,
  MyAssessmentsOverview,
  SaveAnswerInput,
  SavedAnswer,
} from '../../types/assessment';
import type {
  DiscardAssessmentResult,
  MyAssessmentHistory,
} from '../../api/assessmentApi';
import type { PageQuery } from '../../types/pagination';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';
import { markDashboardStale } from '../slices/dashboardSlice';

type ThunkConfig = { rejectValue: StandardizedError };

interface AssessmentStateSlice {
  assessment: {
    submitting: boolean;
    loadingQuestions: boolean;
    requestedCategoryScope: string | null;
    loadingRegenIndex: boolean;
    requestedRegenFieldId: string | null;
    summary: FieldAssessmentSummary | null;
    regenIndex: FieldRegenIndex | null;
    myFields: MyAssessmentsOverview | null;
  };
}

/**
 * The assessment endpoints are scoped by field, never by farm, so no write
 * response carries a farmId. It is recovered from whatever assessment data is
 * already loaded for that field — the summary is authoritative and is always
 * fetched before a question can be answered.
 */
const resolveFarmId = (getState: () => unknown, fieldId: string): string | null => {
  const { assessment } = getState() as AssessmentStateSlice;
  if (assessment.summary?.field.id === fieldId) {
    return assessment.summary.field.farmId;
  }
  if (assessment.regenIndex?.field.id === fieldId) {
    return assessment.regenIndex.field.farmId;
  }
  return assessment.myFields?.fields.find(f => f.fieldId === fieldId)?.farmId ?? null;
};

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

export const fetchAssessmentSummaryThunk = createAsyncThunk<
  FieldAssessmentSummary,
  FieldScopeArg,
  ThunkConfig
>('assessment/fetchSummary', async ({ programId, fieldId }, { rejectWithValue }) => {
  try {
    return await assessmentApi.getAssessmentSummary(programId, fieldId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const refreshAssessmentSummaryThunk = createAsyncThunk<
  FieldAssessmentSummary,
  FieldScopeArg,
  ThunkConfig
>('assessment/refreshSummary', async ({ programId, fieldId }, { rejectWithValue }) => {
  try {
    return await assessmentApi.getAssessmentSummary(programId, fieldId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchCategoryQuestionsThunk = createAsyncThunk<
  CategoryQuestionList,
  CategoryQuestionsArg,
  ThunkConfig
>(
  'assessment/fetchCategoryQuestions',
  async ({ programId, fieldId, categoryId }, { rejectWithValue }) => {
    try {
      return await assessmentApi.getCategoryQuestions(programId, fieldId, categoryId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    // Several screens share the single `categoryQuestions` slot and may ask for
    // the same category at once (e.g. on focus + on state change). Collapse
    // those into the request that is already running.
    condition: (arg, { getState }) => {
      const { assessment } = getState() as AssessmentStateSlice;
      return !(
        assessment.loadingQuestions &&
        assessment.requestedCategoryScope ===
          `${arg.programId}:${arg.fieldId}:${arg.categoryId}`
      );
    },
  },
);

export const fetchQuestionDetailThunk = createAsyncThunk<
  AssessmentQuestionDetail,
  QuestionDetailArg,
  ThunkConfig
>('assessment/fetchQuestionDetail', async ({ programId, fieldId, categoryId, questionId }, { rejectWithValue }) => {
  try {
    return await assessmentApi.getQuestionDetail(programId, fieldId, categoryId, questionId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const saveAssessmentAnswerThunk = createAsyncThunk<
  SavedAnswer,
  SaveAnswerArg,
  ThunkConfig
>(
  'assessment/saveAnswer',
  async ({ programId, fieldId, questionId, input }, { dispatch, getState, rejectWithValue }) => {
    try {
      const answer = await assessmentApi.saveAnswer(programId, fieldId, questionId, input);
      const farmId = resolveFarmId(getState, fieldId);
      if (farmId) {
        dispatch(markDashboardStale(farmId));
      }
      return answer;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export const fetchAssessmentReviewThunk = createAsyncThunk<
  AssessmentReview,
  FieldScopeArg,
  ThunkConfig
>('assessment/fetchReview', async ({ programId, fieldId }, { rejectWithValue }) => {
  try {
    return await assessmentApi.getAssessmentReview(programId, fieldId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const submitAssessmentThunk = createAsyncThunk<
  AssessmentSubmitResult,
  FieldScopeArg,
  ThunkConfig
>(
  'assessment/submit',
  async ({ programId, fieldId }, { dispatch, getState, rejectWithValue }) => {
    // Resolved before the call: submitting can clear the loaded summary downstream.
    const farmId = resolveFarmId(getState, fieldId);
    try {
      const result = await assessmentApi.submitAssessment(programId, fieldId);
      if (farmId) {
        dispatch(markDashboardStale(farmId));
      }
      return result;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (_arg, { getState }) => {
      const state = getState() as AssessmentStateSlice;
      return !state.assessment.submitting;
    },
  },
);

export const discardAssessmentThunk = createAsyncThunk<
  DiscardAssessmentResult,
  FieldScopeArg,
  ThunkConfig
>(
  'assessment/discard',
  async ({ programId, fieldId }, { dispatch, getState, rejectWithValue }) => {
    // Resolved before the call: discarding clears the loaded summary downstream.
    const farmId = resolveFarmId(getState, fieldId);
    try {
      const result = await assessmentApi.discardAssessment(programId, fieldId);
      if (farmId) {
        dispatch(markDashboardStale(farmId));
      }
      return result;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
);

export type MyAssessmentFieldsArg = PageQuery | undefined;

export const fetchMyAssessmentFieldsThunk = createAsyncThunk<
  MyAssessmentsOverview,
  MyAssessmentFieldsArg,
  ThunkConfig
>('assessment/myFields', async (query, { rejectWithValue }) => {
  try {
    return await assessmentApi.getMyAssessmentFields(query);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export interface MyAssessmentHistoryArg extends PageQuery {
  farmId?: string;
}

export const fetchMyAssessmentHistoryThunk = createAsyncThunk<
  MyAssessmentHistory,
  MyAssessmentHistoryArg | undefined,
  ThunkConfig
>('assessment/myHistory', async (arg, { rejectWithValue }) => {
  try {
    return await assessmentApi.getMyAssessmentHistory(arg?.farmId, arg);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchFieldRegenIndexThunk = createAsyncThunk<
  FieldRegenIndex,
  FieldScopeArg,
  ThunkConfig
>(
  'assessment/fetchRegenIndex',
  async ({ programId, fieldId }, { rejectWithValue }) => {
    try {
      return await assessmentApi.getFieldRegenIndex(programId, fieldId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    // Several triggers can ask for the same index at once (first focus, a
    // returning focus, and an answer landing). Collapse them into one request.
    condition: ({ programId, fieldId }, { getState }) => {
      const { assessment } = getState() as AssessmentStateSlice;
      return !(
        assessment.loadingRegenIndex &&
        assessment.requestedRegenFieldId === `${programId}:${fieldId}`
      );
    },
  },
);
