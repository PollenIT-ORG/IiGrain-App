import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type {
    AssessmentQuestionDetail,
    AssessmentReview,
    AssessmentSubmitResult,
    CategoryQuestionList,
    CategoryQuestionSet,
    FieldAssessmentSummary,
    FieldRegenIndex,
    MyAssessmentField,
    MyAssessmentsOverview,
    SaveAnswerInput,
    SaveCategoryAnswersInput,
    SavedAnswer,
} from '../types/assessment';
import {
    normalizePageMeta,
    toPageParams,
    type PageMeta,
    type PageQuery,
    type RawPageMeta,
} from '../types/pagination';
import type { AssessorComparison } from '../types/assessor';
import {
    mapAssessmentSummary,
    mapCategoryQuestionList,
    mapCategoryQuestionSet,
    mapComparison,
    mapFieldHistory,
    mapHistoryItem,
    mapMyAssessments,
    mapQuestionDetail,
    mapRegenIndex,
    mapReview,
    mapSavedAnswer,
    mapSubmitResult,
    type AssessmentSummaryPayload,
    type CategoryQuestionSetPayload,
    type CategoryQuestionsPayload,
    type ComparisonPayload,
    type FieldHistoryPayload,
    type HistoryPayload,
    type MyAssessmentsPayload,
    type QuestionDetailPayload,
    type RawFieldRegenIndex,
    type ReviewPayload,
    type SaveAnswerPayload,
    type SubmitPayload,
} from './assessmentMappers';

interface Envelope<T> {
    data: T;
    meta?: RawPageMeta;
}

const trace = (label: string, payload: Record<string, unknown>): void => {
    if (__DEV__) {
        console.log(`[assessmentApi] ${label} →`, payload);
    }
};

export const getAssessmentSummary = async (
    programId: string,
    fieldId: string,
): Promise<FieldAssessmentSummary> => {
    trace('GET summary', { programId, fieldId });
    const res = await http.get<Envelope<AssessmentSummaryPayload>>(
        Endpoints.assessment.summary(programId, fieldId),
    );
    return mapAssessmentSummary(res.data.data);
};

export const getCategoryQuestions = async (
    programId: string,
    fieldId: string,
    categoryId: string,
): Promise<CategoryQuestionList> => {
    trace('GET categoryQuestions', { programId, fieldId, categoryId });
    const res = await http.get<Envelope<CategoryQuestionsPayload>>(
        Endpoints.assessment.categoryQuestions(programId, fieldId, categoryId),
    );
    return mapCategoryQuestionList(res.data.data);
};

export const getQuestionDetail = async (
    programId: string,
    fieldId: string,
    categoryId: string,
    questionId: string,
): Promise<AssessmentQuestionDetail> => {
    trace('GET question', { programId, fieldId, categoryId, questionId });
    const res = await http.get<Envelope<QuestionDetailPayload>>(
        Endpoints.assessment.question(programId, fieldId, categoryId, questionId),
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
        Endpoints.assessment.categoryQuestionsFull(programId, fieldId, categoryId),
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
        url: Endpoints.assessment.saveCategoryAnswers(programId, fieldId, categoryId),
        programId,
        fieldId,
        categoryId,
        body: input,
    });
    const res = await http.put<Envelope<CategoryQuestionSetPayload>>(
        Endpoints.assessment.saveCategoryAnswers(programId, fieldId, categoryId),
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
        Endpoints.assessment.categoryRecords(programId, fieldId, categoryId),
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
        Endpoints.assessment.categoryRecord(programId, fieldId, categoryId, recordId),
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
        Endpoints.assessment.categoryRecord(programId, fieldId, categoryId, recordId),
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
        url: Endpoints.assessment.saveAnswer(programId, fieldId, questionId),
        programId,
        fieldId,
        questionId,
        body: input,
    });
    const res = await http.put<Envelope<SaveAnswerPayload>>(
        Endpoints.assessment.saveAnswer(programId, fieldId, questionId),
        input,
    );
    return mapSavedAnswer(res.data.data.response);
};

export const getAssessmentReview = async (
    programId: string,
    fieldId: string,
): Promise<AssessmentReview> => {
    trace('GET review', { programId, fieldId });
    const res = await http.get<Envelope<ReviewPayload>>(
        Endpoints.assessment.review(programId, fieldId),
    );
    return mapReview(res.data.data);
};

export const getFieldHistory = async (
    programId: string,
    fieldId: string,
): Promise<AssessmentReview> => {
    trace('GET fieldHistory', { programId, fieldId });
    const res = await http.get<Envelope<FieldHistoryPayload>>(
        Endpoints.assessment.fieldHistory(programId, fieldId),
    );
    return mapFieldHistory(res.data.data);
};

export const submitAssessment = async (
    programId: string,
    fieldId: string,
): Promise<AssessmentSubmitResult> => {
    trace('POST submit', {
        programId,
        fieldId,
        url: Endpoints.assessment.submit(programId, fieldId),
    });
    const res = await http.post<Envelope<SubmitPayload>>(
        Endpoints.assessment.submit(programId, fieldId),
    );
    return mapSubmitResult(res.data.data);
};

export interface DiscardAssessmentResult {
    field: { id: string; name: string };
    discardedAnswers: number;
}

interface RawDiscardPayload {
    field?: { id?: string; name?: string };
    discardedAnswers?: number;
    discarded_answers?: number;
}

export const discardAssessment = async (
    programId: string,
    fieldId: string,
): Promise<DiscardAssessmentResult> => {
    trace('DELETE discard', { programId, fieldId });
    const res = await http.delete<Envelope<RawDiscardPayload>>(
        Endpoints.assessment.discard(programId, fieldId),
    );
    const raw = res.data.data;
    return {
        field: { id: raw.field?.id ?? fieldId, name: raw.field?.name ?? '' },
        discardedAnswers: raw.discardedAnswers ?? raw.discarded_answers ?? 0,
    };
};

export const getMyAssessmentFields = async (
    query?: PageQuery,
): Promise<MyAssessmentsOverview> => {
    trace('GET myFields', { url: Endpoints.assessment.myFields, query });
    const res = await http.get<Envelope<MyAssessmentsPayload>>(
        Endpoints.assessment.myFields,
        { params: toPageParams(query) },
    );
    const overview = mapMyAssessments(res.data.data);
    return {
        ...overview,
        meta: normalizePageMeta(res.data.meta, overview.fields.length, query),
    };
};

export interface MyAssessmentHistory {
    count: number;
    items: MyAssessmentField[];
    meta: PageMeta;
}

export const getMyAssessmentHistory = async (
    farmId?: string,
    query?: PageQuery,
): Promise<MyAssessmentHistory> => {
    trace('GET myHistory', { url: Endpoints.assessment.myHistory, farmId, query });
    const res = await http.get<Envelope<HistoryPayload>>(Endpoints.assessment.myHistory, {
        params: { ...toPageParams(query), ...(farmId ? { farmId } : {}) },
    });
    const data = res.data.data;
    const items = (data.assessments ?? []).map(mapHistoryItem);
    const meta = normalizePageMeta(res.data.meta, items.length, query);
    return { count: data.count ?? meta.total, items, meta };
};

export const getFarmerComparison = async (fieldId: string): Promise<AssessorComparison> => {
    trace('GET comparison', { fieldId, url: Endpoints.assessment.comparison(fieldId) });
    const res = await http.get<Envelope<ComparisonPayload>>(
        Endpoints.assessment.comparison(fieldId),
    );
    return mapComparison(res.data.data);
};

export const getFieldRegenIndex = async (
    programId: string,
    fieldId: string,
): Promise<FieldRegenIndex> => {
    trace('GET regenIndex', { programId, fieldId });
    const res = await http.get<Envelope<RawFieldRegenIndex>>(
        Endpoints.assessment.regenIndex(programId, fieldId),
    );
    return mapRegenIndex(res.data.data);
};

export interface EvidenceUploadFile {
    uri: string;
    name: string;
    mime: string;
}

interface EvidenceUploadPayload {
    urls: string[];
}

interface RawFilePart {
    uri: string;
    name: string;
    type: string;
}

export const uploadEvidence = async (
    files: EvidenceUploadFile[],
): Promise<string[]> => {
    trace('POST uploadEvidence', {
        count: files.length,
        files: files.map(f => ({ name: f.name, mime: f.mime })),
    });
    const form = new FormData();
    files.forEach(file => {
        const part: RawFilePart = { uri: file.uri, name: file.name, type: file.mime };
        form.append('files', part as unknown as Blob);
    });
    const res = await http.post<Envelope<EvidenceUploadPayload>>(
        Endpoints.assessment.uploadEvidence,
        form,
        EVIDENCE_UPLOAD_CONFIG,
    );
    return res.data.data.urls ?? [];
};

const EVIDENCE_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const EVIDENCE_UPLOAD_CONFIG = {
    timeout: EVIDENCE_UPLOAD_TIMEOUT_MS,
    skipRetry: true,
} as const;

export const uploadEvidenceFile = async (
    file: EvidenceUploadFile,
    onProgress?: (fraction: number) => void,
): Promise<string> => {
    trace('POST uploadEvidenceFile', { name: file.name, mime: file.mime });
    const form = new FormData();
    const part: RawFilePart = { uri: file.uri, name: file.name, type: file.mime };
    form.append('files', part as unknown as Blob);
    const res = await http.post<Envelope<EvidenceUploadPayload>>(
        Endpoints.assessment.uploadEvidence,
        form,
        {
            ...EVIDENCE_UPLOAD_CONFIG,
            onUploadProgress: event => {
                if (onProgress && event.total) {
                    onProgress(Math.min(event.loaded / event.total, 1));
                }
            },
        },
    );
    const url = res.data.data.urls?.[0];
    if (!url) {
        throw new Error('Evidence upload returned no URL.');
    }
    return url;
};
