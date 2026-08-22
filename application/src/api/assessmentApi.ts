import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type {
    AssessmentCategorySummary,
    AssessmentField,
    AssessmentInfo,
    AssessmentQuestionDetail,
    AssessmentQuestionListItem,
    AssessmentReview,
    AssessmentReviewCategory,
    AssessmentReviewQuestion,
    AssessmentStatus,
    AssessmentSubmissionInfo,
    AssessmentSubmitResult,
    CategoryQuestionList,
    FieldAssessmentSummary,
    FieldRegenIndex,
    MyAssessmentCounts,
    MyAssessmentField,
    MyAssessmentsOverview,
    QuestionScore,
    QuestionScoreDescription,
    SaveAnswerInput,
    SavedAnswer,
} from '../types/assessment';
import {
    normalizePageMeta,
    toPageParams,
    type PageMeta,
    type PageQuery,
    type RawPageMeta,
} from '../types/pagination';

interface Envelope<T> {
    data: T;
    meta?: RawPageMeta;
}

interface RawAssessmentField {
    id: string;
    name: string;
    farmId: string;
    farmName: string;
}

interface RawAssessment {
    title: string;
    year: number;
    status: string;
    totalQuestions: number;
    answered: number;
    percentage: number;
}

interface RawAssessmentCategory {
    id: string;
    name: string;
    totalQuestions: number;
    answered: number;
    percentage: number;
}

interface AssessmentSummaryPayload {
    field: RawAssessmentField;
    assessment: RawAssessment;
    categories: RawAssessmentCategory[];
}

interface RawRef {
    id: string;
    name: string;
}

interface RawQuestionProgress {
    totalQuestions: number;
    answered: number;
    percentage: number;
}

interface RawQuestionListItem {
    id: string;
    questionCode: string;
    questionText: string;
    guidanceNote: string;
    answered: boolean;
}

interface CategoryQuestionsPayload {
    field: RawRef;
    category: RawRef;
    progress: RawQuestionProgress;
    questions: RawQuestionListItem[];
}

interface RawScoreDescriptions {
    score0?: string;
    score1?: string;
    score2?: string;
    score3?: string;
}

interface RawQuestionDetail {
    id: string;
    questionCode: string;
    questionText: string;
    guidanceNote: string;
    scoreDescriptions: RawScoreDescriptions;
    answerScore: number | null;
    answerComment: string | null;
    answerEvidenceUrls: string[];
    answered: boolean;
}

interface QuestionDetailPayload {
    field: RawRef;
    category: RawRef;
    question: RawQuestionDetail;
    locked: boolean;
}

interface RawSavedAnswer {
    id: string;
    field_id: string;
    question_id: string;
    score: number;
    comment: string | null;
    evidence_urls: string[];
    created_at: string;
    updated_at: string;
}

interface SaveAnswerPayload {
    response: RawSavedAnswer;
}

interface RawReviewQuestion {
    id: string;
    questionCode: string;
    questionText: string;
    answerScore: number | null;
    answerComment: string | null;
    answerEvidenceUrls: string[];
    answered: boolean;
}

interface RawReviewCategory {
    id: string;
    name: string;
    totalQuestions: number;
    answered: number;
    percentage: number;
    questions: RawReviewQuestion[];
}

interface RawSubmission {
    status: string;
    submittedAt: string | null;
    totalQuestions: number;
    answered: number;
    percentage: number;
}

interface ReviewPayload {
    field: RawRef;
    submission: RawSubmission;
    categories: RawReviewCategory[];
}

interface RawSubmitAssessment {
    id: string;
    field_id: string;
    status: string;
    total_questions: number;
    answered: number;
    total_score: number;
    max_score: number;
    percentage: string | number;
    submitted_at: string;
    created_at: string;
    updated_at: string;
}

interface SubmitPayload {
    field: RawRef;
    assessment: RawSubmitAssessment;
}

const toQuestionScore = (raw: number | null | undefined): QuestionScore | null =>
    raw === 0 || raw === 1 || raw === 2 || raw === 3 ? raw : null;

const mapAssessmentStatus = (raw: string): AssessmentStatus => {
    switch (raw) {
        case 'in_progress':
            return 'IN_PROGRESS';
        case 'completed':
        case 'submitted':
            return 'COMPLETED';
        case 'not_started':
        default:
            return 'PENDING';
    }
};

const mapAssessmentField = (raw: RawAssessmentField): AssessmentField => ({
    id: raw.id,
    name: raw.name ?? '',
    farmId: raw.farmId,
    farmName: raw.farmName ?? '',
});

const mapAssessment = (raw: RawAssessment): AssessmentInfo => ({
    title: raw.title ?? '',
    year: raw.year ?? 0,
    status: mapAssessmentStatus(raw.status),
    totalQuestions: raw.totalQuestions ?? 0,
    answered: raw.answered ?? 0,
    percentage: raw.percentage ?? 0,
    submitted: raw.status === 'submitted',
});

const mapAssessmentCategory = (
    raw: RawAssessmentCategory,
): AssessmentCategorySummary => ({
    id: raw.id,
    name: raw.name ?? '',
    totalQuestions: raw.totalQuestions ?? 0,
    answered: raw.answered ?? 0,
    percentage: raw.percentage ?? 0,
});

const mapAssessmentSummary = (
    payload: AssessmentSummaryPayload,
): FieldAssessmentSummary => ({
    field: mapAssessmentField(payload.field),
    assessment: mapAssessment(payload.assessment),
    categories: (payload.categories ?? []).map(mapAssessmentCategory),
});

const mapQuestionListItem = (
    raw: RawQuestionListItem,
): AssessmentQuestionListItem => ({
    id: raw.id,
    code: raw.questionCode ?? '',
    text: raw.questionText ?? '',
    guidance: raw.guidanceNote ?? '',
    answered: !!raw.answered,
});

const mapCategoryQuestionList = (
    payload: CategoryQuestionsPayload,
): CategoryQuestionList => ({
    field: { id: payload.field.id, name: payload.field.name ?? '' },
    category: { id: payload.category.id, name: payload.category.name ?? '' },
    progress: {
        totalQuestions: payload.progress?.totalQuestions ?? 0,
        answered: payload.progress?.answered ?? 0,
        percentage: payload.progress?.percentage ?? 0,
    },
    questions: (payload.questions ?? []).map(mapQuestionListItem),
});

const mapScoreDescriptions = (
    raw: RawScoreDescriptions | undefined,
): QuestionScoreDescription[] => [
    { score: 0, description: raw?.score0 ?? '' },
    { score: 1, description: raw?.score1 ?? '' },
    { score: 2, description: raw?.score2 ?? '' },
    { score: 3, description: raw?.score3 ?? '' },
];

const mapQuestionDetail = (
    payload: QuestionDetailPayload,
): AssessmentQuestionDetail => {
    const q = payload.question;
    return {
        id: q.id,
        code: q.questionCode ?? '',
        text: q.questionText ?? '',
        guidance: q.guidanceNote ?? '',
        scoreDescriptions: mapScoreDescriptions(q.scoreDescriptions),
        answerScore: toQuestionScore(q.answerScore),
        answerComment: q.answerComment ?? null,
        answerEvidenceUrls: q.answerEvidenceUrls ?? [],
        answered: !!q.answered,
        locked: !!payload.locked,
    };
};

const mapSavedAnswer = (raw: RawSavedAnswer): SavedAnswer => ({
    id: raw.id,
    fieldId: raw.field_id,
    questionId: raw.question_id,
    score: toQuestionScore(raw.score) ?? 0,
    comment: raw.comment ?? '',
    evidenceUrls: raw.evidence_urls ?? [],
    createdAtISO: raw.created_at,
    updatedAtISO: raw.updated_at,
});

const toPercentage = (raw: string | number | null | undefined): number => {
    const n = typeof raw === 'string' ? Number.parseFloat(raw) : raw ?? 0;
    if (!Number.isFinite(n)) {
        return 0;
    }
    return Math.min(Math.max(n, 0), 100);
};

const mapReviewQuestion = (raw: RawReviewQuestion): AssessmentReviewQuestion => ({
    id: raw.id,
    code: raw.questionCode ?? '',
    text: raw.questionText ?? '',
    score: toQuestionScore(raw.answerScore),
    comment: raw.answerComment ?? '',
    evidenceUrls: raw.answerEvidenceUrls ?? [],
    answered: !!raw.answered,
});

const mapReviewCategory = (raw: RawReviewCategory): AssessmentReviewCategory => ({
    id: raw.id,
    name: raw.name ?? '',
    totalQuestions: raw.totalQuestions ?? 0,
    answered: raw.answered ?? 0,
    percentage: toPercentage(raw.percentage),
    questions: (raw.questions ?? []).map(mapReviewQuestion),
});

const mapSubmission = (raw: RawSubmission): AssessmentSubmissionInfo => ({
    status: mapAssessmentStatus(raw.status),
    submittedAtISO: raw.submittedAt ?? null,
    totalQuestions: raw.totalQuestions ?? 0,
    answered: raw.answered ?? 0,
    percentage: toPercentage(raw.percentage),
});

const mapReview = (payload: ReviewPayload): AssessmentReview => ({
    field: { id: payload.field.id, name: payload.field.name ?? '' },
    submission: mapSubmission(payload.submission),
    categories: (payload.categories ?? []).map(mapReviewCategory),
});

const mapSubmitResult = (payload: SubmitPayload): AssessmentSubmitResult => {
    const a = payload.assessment;
    return {
        field: { id: payload.field.id, name: payload.field.name ?? '' },
        assessmentId: a.id,
        status: mapAssessmentStatus(a.status),
        totalQuestions: a.total_questions ?? 0,
        answered: a.answered ?? 0,
        totalScore: a.total_score ?? 0,
        maxScore: a.max_score ?? 0,
        percentage: toPercentage(a.percentage),
        submittedAtISO: a.submitted_at,
    };
};

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

interface RawMyAssessmentField {
    field: { id: string; name: string; crop: string; status: string };
    farm: { id: string; name: string };
    program?: { id: string | null; name: string | null } | null;
    assessment: {
        status: string;
        inProgress: boolean;
        completed: boolean;
        totalQuestions: number;
        answered: number;
        percentage: number;
        submittedAt: string | null;
    };
}
interface MyAssessmentsPayload {
    year: number;
    title: string;
    counts: { total: number; notStarted: number; inProgress: number; completed: number };
    fields: RawMyAssessmentField[];
}

const mapMyAssessmentField = (raw: RawMyAssessmentField): MyAssessmentField => ({
    fieldId: raw.field.id,
    fieldName: raw.field.name ?? '',
    crop: raw.field.crop ?? '',
    fieldStatus: raw.field.status ?? '',
    farmId: raw.farm.id,
    farmName: raw.farm.name ?? '',
    programId: raw.program?.id ?? '',
    programName: raw.program?.name ?? '',
    status: mapAssessmentStatus(raw.assessment.status),
    totalQuestions: raw.assessment.totalQuestions ?? 0,
    answered: raw.assessment.answered ?? 0,
    percentage: toPercentage(raw.assessment.percentage),
    submittedAtISO: raw.assessment.submittedAt ?? null,
});

const mapMyAssessments = (payload: MyAssessmentsPayload): MyAssessmentsOverview => {
    const counts: MyAssessmentCounts = {
        total: payload.counts?.total ?? 0,
        notStarted: payload.counts?.notStarted ?? 0,
        inProgress: payload.counts?.inProgress ?? 0,
        completed: payload.counts?.completed ?? 0,
    };
    return {
        year: payload.year ?? 0,
        title: payload.title ?? '',
        counts,
        fields: (payload.fields ?? []).map(mapMyAssessmentField),
    };
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

interface RawHistoryItem {
    field: { id: string; name: string; crop: string | null };
    farm: { id: string; name: string };
    program?: { id: string | null; name: string | null } | null;
    assessment: {
        totalQuestions: number;
        answered: number;
        percentage: number;
        submittedAt: string | null;
    };
}
interface HistoryPayload {
    count: number;
    assessments: RawHistoryItem[];
}

export interface MyAssessmentHistory {
    count: number;
    items: MyAssessmentField[];
    meta: PageMeta;
}

const mapHistoryItem = (raw: RawHistoryItem): MyAssessmentField => ({
    fieldId: raw.field.id,
    fieldName: raw.field.name ?? '',
    crop: raw.field.crop ?? '',
    fieldStatus: '',
    farmId: raw.farm.id,
    farmName: raw.farm.name ?? '',
    programId: raw.program?.id ?? '',
    programName: raw.program?.name ?? '',
    status: 'COMPLETED',
    totalQuestions: raw.assessment.totalQuestions ?? 0,
    answered: raw.assessment.answered ?? 0,
    percentage: toPercentage(raw.assessment.percentage),
    submittedAtISO: raw.assessment.submittedAt ?? null,
});

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

interface RawRegenCategory {
    id: string;
    name: string;
    score: number | null;
    answered: number;
}

interface RawFieldRegenIndex {
    field: RawAssessmentField;
    regenHealthIndex: number | null;
    rating: string | null;
    categories: RawRegenCategory[];
    topCategory: string | null;
}

const mapRegenIndex = (raw: RawFieldRegenIndex): FieldRegenIndex => ({
    field: mapAssessmentField(raw.field),
    regenHealthIndex: raw.regenHealthIndex,
    rating: raw.rating,
    categories: (raw.categories ?? []).map(c => ({
        id: c.id,
        name: c.name ?? '',
        score: c.score,
        answered: c.answered ?? 0,
    })),
    topCategory: raw.topCategory,
});

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
