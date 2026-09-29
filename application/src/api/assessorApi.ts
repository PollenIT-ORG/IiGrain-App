import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type {
  AssessmentQuestionDetail,
  AssessmentReview,
  AssessmentSubmitResult,
  CategoryQuestionList,
  CategoryQuestionSet,
  SaveAnswerInput,
  SaveCategoryAnswersInput,
  SavedAnswer,
} from '../types/assessment';
import type {
  AssessorAssessmentSummary,
  AssessorComparison,
  AssessorFieldsOverview,
  FarmerAssessmentView,
} from '../types/assessor';
import {
  mapAssessorSummary,
  mapCategoryQuestionList,
  mapCategoryQuestionSet,
  mapComparison,
  mapFarmerAssessment,
  mapFieldsOverview,
  mapQuestionDetail,
  mapReview,
  mapSavedAnswer,
  mapSubmitResult,
  type CategoryQuestionSetPayload,
  type CategoryQuestionsPayload,
  type ComparisonPayload,
  type FarmerAssessmentPayload,
  type FieldsPayload,
  type QuestionDetailPayload,
  type ReviewPayload,
  type SaveAnswerPayload,
  type SubmitPayload,
  type SummaryPayload,
} from './assessorMappers';

interface Envelope<T> {
  data: T;
}

const trace = (label: string, payload: Record<string, unknown>): void => {
  if (__DEV__) {
    console.log(`[assessorApi] ${label} →`, payload);
  }
};

export const getFields = async (): Promise<AssessorFieldsOverview> => {
  trace('GET fields', { url: Endpoints.assessor.fields });
  const res = await http.get<Envelope<FieldsPayload>>(Endpoints.assessor.fields);
  return mapFieldsOverview(res.data.data);
};

export const getSummary = async (
  programId: string,
  fieldId: string,
): Promise<AssessorAssessmentSummary> => {
  trace('GET summary', { programId, fieldId });
  const res = await http.get<Envelope<SummaryPayload>>(
    Endpoints.assessor.summary(programId, fieldId),
  );
  return mapAssessorSummary(res.data.data);
};

export const getCategoryQuestions = async (
  programId: string,
  fieldId: string,
  categoryId: string,
): Promise<CategoryQuestionList> => {
  trace('GET categoryQuestions', { programId, fieldId, categoryId });
  const res = await http.get<Envelope<CategoryQuestionsPayload>>(
    Endpoints.assessor.categoryQuestions(programId, fieldId, categoryId),
  );
  return mapCategoryQuestionList(res.data.data);
};

export const getQuestion = async (
  programId: string,
  fieldId: string,
  categoryId: string,
  questionId: string,
): Promise<AssessmentQuestionDetail> => {
  trace('GET question', { programId, fieldId, categoryId, questionId });
  const res = await http.get<Envelope<QuestionDetailPayload>>(
    Endpoints.assessor.question(programId, fieldId, categoryId, questionId),
  );
  return mapQuestionDetail(res.data.data);
};

export const getCategoryQuestionSet = async (
  programId: string,
  fieldId: string,
  categoryId: string,
): Promise<CategoryQuestionSet> => {
  trace('GET categoryQuestionSet', { programId, fieldId, categoryId });
  const res = await http.get<Envelope<CategoryQuestionSetPayload>>(
    Endpoints.assessor.categoryQuestionsFull(programId, fieldId, categoryId),
  );
  return mapCategoryQuestionSet(res.data.data);
};

export const saveCategoryAnswers = async (
  programId: string,
  fieldId: string,
  categoryId: string,
  input: SaveCategoryAnswersInput,
): Promise<CategoryQuestionSet> => {
  trace('PUT saveCategoryAnswers', {
    url: Endpoints.assessor.saveCategoryAnswers(programId, fieldId, categoryId),
    programId,
    fieldId,
    categoryId,
    body: input,
  });
  const res = await http.put<Envelope<CategoryQuestionSetPayload>>(
    Endpoints.assessor.saveCategoryAnswers(programId, fieldId, categoryId),
    input,
  );
  return mapCategoryQuestionSet(res.data.data);
};

export const addCategoryRecord = async (
  programId: string,
  fieldId: string,
  categoryId: string,
  input: SaveCategoryAnswersInput,
): Promise<CategoryQuestionSet> => {
  trace('POST addCategoryRecord', { programId, fieldId, categoryId, body: input });
  const res = await http.post<Envelope<CategoryQuestionSetPayload>>(
    Endpoints.assessor.categoryRecords(programId, fieldId, categoryId),
    input,
  );
  return mapCategoryQuestionSet(res.data.data);
};

export const updateCategoryRecord = async (
  programId: string,
  fieldId: string,
  categoryId: string,
  recordId: string,
  input: SaveCategoryAnswersInput,
): Promise<CategoryQuestionSet> => {
  trace('PUT updateCategoryRecord', { programId, fieldId, categoryId, recordId, body: input });
  const res = await http.put<Envelope<CategoryQuestionSetPayload>>(
    Endpoints.assessor.categoryRecord(programId, fieldId, categoryId, recordId),
    input,
  );
  return mapCategoryQuestionSet(res.data.data);
};

export const deleteCategoryRecord = async (
  programId: string,
  fieldId: string,
  categoryId: string,
  recordId: string,
): Promise<CategoryQuestionSet> => {
  trace('DELETE deleteCategoryRecord', { programId, fieldId, categoryId, recordId });
  const res = await http.delete<Envelope<CategoryQuestionSetPayload>>(
    Endpoints.assessor.categoryRecord(programId, fieldId, categoryId, recordId),
  );
  return mapCategoryQuestionSet(res.data.data);
};

export const saveAnswer = async (
  programId: string,
  fieldId: string,
  questionId: string,
  input: SaveAnswerInput,
): Promise<SavedAnswer> => {
  trace('PUT saveAnswer', {
    url: Endpoints.assessor.saveAnswer(programId, fieldId, questionId),
    programId,
    fieldId,
    questionId,
    body: input,
  });
  const res = await http.put<Envelope<SaveAnswerPayload>>(
    Endpoints.assessor.saveAnswer(programId, fieldId, questionId),
    input,
  );
  return mapSavedAnswer(res.data.data.response);
};

export const getReview = async (
  programId: string,
  fieldId: string,
): Promise<AssessmentReview> => {
  trace('GET review', { programId, fieldId });
  const res = await http.get<Envelope<ReviewPayload>>(
    Endpoints.assessor.review(programId, fieldId),
  );
  return mapReview(res.data.data);
};

export const submit = async (
  programId: string,
  fieldId: string,
): Promise<AssessmentSubmitResult> => {
  trace('POST submit', { programId, fieldId, url: Endpoints.assessor.submit(programId, fieldId) });
  const res = await http.post<Envelope<SubmitPayload>>(
    Endpoints.assessor.submit(programId, fieldId),
  );
  return mapSubmitResult(res.data.data);
};

export const getFarmerAssessment = async (
  programId: string,
  fieldId: string,
): Promise<FarmerAssessmentView> => {
  trace('GET farmerAssessment', { programId, fieldId });
  const res = await http.get<Envelope<FarmerAssessmentPayload>>(
    Endpoints.assessor.farmerAssessment(programId, fieldId),
  );
  return mapFarmerAssessment(res.data.data);
};

export const getComparison = async (
  programId: string,
  fieldId: string,
): Promise<AssessorComparison> => {
  trace('GET comparison', { programId, fieldId });
  const res = await http.get<Envelope<ComparisonPayload>>(
    Endpoints.assessor.comparison(programId, fieldId),
  );
  return mapComparison(res.data.data);
};
