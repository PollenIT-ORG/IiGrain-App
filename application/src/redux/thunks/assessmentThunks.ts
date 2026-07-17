import { createAsyncThunk } from '@reduxjs/toolkit';
import * as assessmentApi from '../../api/assessmentApi';
import type {
  AssessmentQuestionDetail,
  AssessmentReview,
  AssessmentSubmitResult,
  CategoryQuestionList,
  FieldAssessmentSummary,
  MyAssessmentsOverview,
  SaveAnswerInput,
  SavedAnswer,
} from '../../types/assessment';
import { handleApiError, StandardizedError } from '../../utils/handleApiError';

type ThunkConfig = { rejectValue: StandardizedError };

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

export const fetchAssessmentSummaryThunk = createAsyncThunk<
  FieldAssessmentSummary,
  string,
  ThunkConfig
>('assessment/fetchSummary', async (fieldId, { rejectWithValue }) => {
  try {
    return await assessmentApi.getAssessmentSummary(fieldId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const refreshAssessmentSummaryThunk = createAsyncThunk<
  FieldAssessmentSummary,
  string,
  ThunkConfig
>('assessment/refreshSummary', async (fieldId, { rejectWithValue }) => {
  try {
    return await assessmentApi.getAssessmentSummary(fieldId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchCategoryQuestionsThunk = createAsyncThunk<
  CategoryQuestionList,
  CategoryQuestionsArg,
  ThunkConfig
>('assessment/fetchCategoryQuestions', async ({ fieldId, categoryId }, { rejectWithValue }) => {
  try {
    return await assessmentApi.getCategoryQuestions(fieldId, categoryId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchQuestionDetailThunk = createAsyncThunk<
  AssessmentQuestionDetail,
  QuestionDetailArg,
  ThunkConfig
>('assessment/fetchQuestionDetail', async ({ fieldId, categoryId, questionId }, { rejectWithValue }) => {
  try {
    return await assessmentApi.getQuestionDetail(fieldId, categoryId, questionId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const saveAssessmentAnswerThunk = createAsyncThunk<
  SavedAnswer,
  SaveAnswerArg,
  ThunkConfig
>('assessment/saveAnswer', async ({ fieldId, questionId, input }, { rejectWithValue }) => {
  try {
    return await assessmentApi.saveAnswer(fieldId, questionId, input);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const fetchAssessmentReviewThunk = createAsyncThunk<
  AssessmentReview,
  string,
  ThunkConfig
>('assessment/fetchReview', async (fieldId, { rejectWithValue }) => {
  try {
    return await assessmentApi.getAssessmentReview(fieldId);
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

export const submitAssessmentThunk = createAsyncThunk<
  AssessmentSubmitResult,
  string,
  ThunkConfig
>(
  'assessment/submit',
  async (fieldId, { rejectWithValue }) => {
    try {
      return await assessmentApi.submitAssessment(fieldId);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  },
  {
    condition: (_fieldId, { getState }) => {
      const state = getState() as { assessment: { submitting: boolean } };
      return !state.assessment.submitting;
    },
  },
);

export const fetchMyAssessmentFieldsThunk = createAsyncThunk<
  MyAssessmentsOverview,
  void,
  ThunkConfig
>('assessment/myFields', async (_arg, { rejectWithValue }) => {
  try {
    return await assessmentApi.getMyAssessmentFields();
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});
