import type {
    AnswerExtra,
    AssessmentCategorySummary,
    AssessmentField,
    AssessmentInfo,
    AssessmentProgramInfo,
    AssessmentQuestionDetail,
    AssessmentQuestionListItem,
    AssessmentRecord,
    AssessmentRecordAnswer,
    AssessmentReview,
    AssessmentReviewCategory,
    AssessmentReviewQuestion,
    AssessmentStatus,
    AssessmentSubmissionInfo,
    AssessmentSubmitResult,
    CategoryQuestionList,
    CategoryQuestionSet,
    FieldAssessmentSummary,
    FieldRegenIndex,
    MyAssessmentCounts,
    MyAssessmentField,
    MyAssessmentsOverview,
    QuestionKind,
    QuestionOption,
    QuestionScore,
    QuestionScoreDescription,
    QuestionType,
    ReviewStatus,
    SavedAnswer,
} from '../types/assessment';
import type { AssessorComparison, ComparisonCategory, ComparisonQuestion } from '../types/assessor';

export interface RawAssessmentField {
    id: string;
    name: string;
    farmId: string;
    farmName: string;
}

export interface RawAssessment {
    title: string;
    year: number;
    status: string;
    totalQuestions: number;
    answered: number;
    percentage: number;
    questionKind?: string;
}

export interface RawAssessmentCategory {
    id: string;
    name: string;
    totalQuestions: number;
    answered: number;
    percentage: number;
    records?: number;
}

export interface RawProgramInfo {
    active: boolean;
    ended: boolean;
    endDate: string | null;
    assessmentOpen: boolean;
}

export interface AssessmentSummaryPayload {
    field: RawAssessmentField;
    assessment: RawAssessment;
    categories: RawAssessmentCategory[];
    canEdit?: boolean;
    reviewStatus?: string | null;
    program?: RawProgramInfo | null;
}

export interface RawRef {
    id: string;
    name: string;
}

export interface RawQuestionProgress {
    totalQuestions: number;
    answered: number;
    percentage: number;
}

export interface RawQuestionListItem {
    id: string;
    questionCode: string;
    questionText: string;
    guidanceNote: string;
    answered: boolean;
}

export interface CategoryQuestionsPayload {
    field: RawRef;
    category: RawRef;
    progress: RawQuestionProgress;
    questions: RawQuestionListItem[];
}

export interface RawScoreDescriptions {
    score0?: string;
    score1?: string;
    score2?: string;
    score3?: string;
}

export interface RawQuestionOption {
    id: string;
    text: string;
    score: number;
}

export interface RawQuestionDetail {
    id: string;
    questionCode: string;
    questionText: string;
    guidanceNote: string;
    questionType?: string;
    maxScore?: number;
    options?: RawQuestionOption[];
    evidenceMode?: string;
    commentMode?: string;
    scoreDescriptions: RawScoreDescriptions;
    answerScore: number | null;
    answerOptionId?: string | null;
    answerOptionText?: string | null;
    answerText?: string | null;
    answerNumber?: number | null;
    answerDate?: string | null;
    answerBoolean?: boolean | null;
    answerComment: string | null;
    answerEvidenceUrls: string[];
    reviewScore?: number | null;
    finalScore?: number | null;
    answered: boolean;
}

export interface QuestionDetailPayload {
    field: RawRef;
    category: RawRef;
    question: RawQuestionDetail;
    locked: boolean;
}

export interface RawSavedAnswer {
    id: string;
    field_id: string;
    question_id: string;
    question_type?: string;
    score: number | null;
    option_id?: string | null;
    answer_text?: string | null;
    answer_number?: number | null;
    answer_date?: string | null;
    answer_boolean?: boolean | null;
    comment: string | null;
    evidence_urls: string[];
    created_at: string;
    updated_at: string;
}

export interface SaveAnswerPayload {
    response: RawSavedAnswer;
}

export interface RawReviewQuestion {
    id: string;
    questionCode: string;
    questionText: string;
    questionType?: string;
    maxScore?: number;
    options?: RawQuestionOption[];
    evidenceMode?: string;
    commentMode?: string;
    answerScore: number | null;
    answerOptionId?: string | null;
    answerOptionText?: string | null;
    answerText?: string | null;
    answerNumber?: number | null;
    answerDate?: string | null;
    answerBoolean?: boolean | null;
    reviewScore?: number | null;
    finalScore?: number | null;
    answerComment: string | null;
    answerEvidenceUrls: string[];
    answered: boolean;
}

export interface RawReviewCategory {
    id: string;
    name: string;
    totalQuestions: number;
    answered: number;
    percentage: number;
    questions: RawReviewQuestion[];
}

export interface RawSubmission {
    status: string;
    submittedAt: string | null;
    totalQuestions: number;
    answered: number;
    percentage: number;
    reviewStatus?: string | null;
    reviewNote?: string | null;
}

export interface RawHistoryCategory {
    id: string;
    name: string;
    totalQuestions: number;
    answered: number;
    questions: RawReviewQuestion[];
}

export interface FieldHistoryPayload {
    field: RawRef;
    status: string;
    reviewStatus?: string | null;
    reviewNote?: string | null;
    submittedAt: string | null;
    score: {
        totalQuestions: number;
        answered: number;
        totalScore: number;
        maxScore: number;
        percentage: number;
    };
    categories: RawHistoryCategory[];
}

export interface ReviewPayload {
    field: RawRef;
    submission: RawSubmission;
    categories: RawReviewCategory[];
}

export interface RawSubmitAssessment {
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
    review_status?: string | null;
    reviewed_at?: string | null;
    review_note?: string | null;
}

export interface SubmitPayload {
    field: RawRef;
    assessment: RawSubmitAssessment;
}

const toQuestionScore = (raw: number | null | undefined): QuestionScore | null =>
    raw === 0 || raw === 1 || raw === 2 || raw === 3 ? raw : null;

const QUESTION_TYPES: QuestionType[] = [
    'scored',
    'mcq',
    'text',
    'long_text',
    'number',
    'date',
    'boolean',
];

const toQuestionType = (raw: string | undefined): QuestionType =>
    QUESTION_TYPES.includes(raw as QuestionType) ? (raw as QuestionType) : 'scored';

const toAnswerExtra = (raw: string | undefined): AnswerExtra =>
    raw === 'off' || raw === 'optional' || raw === 'required' ? raw : 'optional';

const toReviewStatus = (raw: string | null | undefined): ReviewStatus =>
    raw === 'in_review' || raw === 'approved' ? raw : null;

const toQuestionKind = (raw: string | undefined): QuestionKind => (raw === 'input' ? 'input' : 'mcq');

const toStatedQuestionKind = (raw: string | undefined): QuestionKind | null =>
    raw === 'input' || raw === 'mcq' ? raw : null;

const toPercentage = (raw: string | number | null | undefined): number => {
    const n = typeof raw === 'string' ? Number.parseFloat(raw) : raw ?? 0;
    if (!Number.isFinite(n)) {
        return 0;
    }
    return Math.min(Math.max(n, 0), 100);
};

const mapQuestionOption = (raw: RawQuestionOption): QuestionOption => ({
    id: raw.id,
    text: raw.text ?? '',
    score: raw.score ?? 0,
});

const mapProgramInfo = (raw: RawProgramInfo | null | undefined): AssessmentProgramInfo => ({
    active: raw?.active ?? true,
    ended: raw?.ended ?? false,
    endDate: raw?.endDate ?? null,
    assessmentOpen: raw?.assessmentOpen ?? true,
});

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
    questionKind: toQuestionKind(raw.questionKind),
});

const mapAssessmentCategory = (
    raw: RawAssessmentCategory,
): AssessmentCategorySummary => ({
    id: raw.id,
    name: raw.name ?? '',
    totalQuestions: raw.totalQuestions ?? 0,
    answered: raw.answered ?? 0,
    percentage: raw.percentage ?? 0,
    records: raw.records ?? 0,
});

export const mapAssessmentSummary = (
    payload: AssessmentSummaryPayload,
): FieldAssessmentSummary => ({
    field: mapAssessmentField(payload.field),
    assessment: mapAssessment(payload.assessment),
    categories: (payload.categories ?? []).map(mapAssessmentCategory),
    canEdit: payload.canEdit ?? true,
    reviewStatus: toReviewStatus(payload.reviewStatus),
    program: mapProgramInfo(payload.program),
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

export const mapCategoryQuestionList = (
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

export const mapQuestionDetail = (
    payload: QuestionDetailPayload,
): AssessmentQuestionDetail => {
    const q = payload.question;
    return {
        id: q.id,
        code: q.questionCode ?? '',
        text: q.questionText ?? '',
        guidance: q.guidanceNote ?? '',
        questionType: toQuestionType(q.questionType),
        maxScore: q.maxScore ?? 3,
        options: (q.options ?? []).map(mapQuestionOption),
        evidenceMode: toAnswerExtra(q.evidenceMode),
        commentMode: toAnswerExtra(q.commentMode),
        scoreDescriptions: mapScoreDescriptions(q.scoreDescriptions),
        answerScore: toQuestionScore(q.answerScore),
        answerOptionId: q.answerOptionId ?? null,
        answerOptionText: q.answerOptionText ?? null,
        answerText: q.answerText ?? null,
        answerNumber: q.answerNumber ?? null,
        answerDate: q.answerDate ?? null,
        answerBoolean: q.answerBoolean ?? null,
        answerComment: q.answerComment ?? null,
        answerEvidenceUrls: q.answerEvidenceUrls ?? [],
        reviewScore: q.reviewScore ?? null,
        finalScore: q.finalScore ?? null,
        answered: !!q.answered,
        locked: !!payload.locked,
    };
};

export const mapSavedAnswer = (raw: RawSavedAnswer): SavedAnswer => ({
    id: raw.id,
    fieldId: raw.field_id,
    questionId: raw.question_id,
    questionType: toQuestionType(raw.question_type),
    score: toQuestionScore(raw.score),
    optionId: raw.option_id ?? null,
    answerText: raw.answer_text ?? null,
    answerNumber: raw.answer_number ?? null,
    answerDate: raw.answer_date ?? null,
    answerBoolean: raw.answer_boolean ?? null,
    comment: raw.comment ?? '',
    evidenceUrls: raw.evidence_urls ?? [],
    createdAtISO: raw.created_at,
    updatedAtISO: raw.updated_at,
});

const mapReviewQuestion = (raw: RawReviewQuestion): AssessmentReviewQuestion => ({
    id: raw.id,
    code: raw.questionCode ?? '',
    text: raw.questionText ?? '',
    questionType: toQuestionType(raw.questionType),
    maxScore: raw.maxScore ?? 3,
    options: (raw.options ?? []).map(mapQuestionOption),
    evidenceMode: toAnswerExtra(raw.evidenceMode),
    commentMode: toAnswerExtra(raw.commentMode),
    score: toQuestionScore(raw.answerScore),
    optionId: raw.answerOptionId ?? null,
    optionText: raw.answerOptionText ?? null,
    answerText: raw.answerText ?? null,
    answerNumber: raw.answerNumber ?? null,
    answerDate: raw.answerDate ?? null,
    answerBoolean: raw.answerBoolean ?? null,
    reviewScore: raw.reviewScore ?? null,
    finalScore: raw.finalScore ?? null,
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
    reviewStatus: toReviewStatus(raw.reviewStatus),
    reviewNote: raw.reviewNote ?? null,
});

export const mapReview = (payload: ReviewPayload): AssessmentReview => ({
    field: { id: payload.field.id, name: payload.field.name ?? '' },
    submission: mapSubmission(payload.submission),
    categories: (payload.categories ?? []).map(mapReviewCategory),
});

export const mapSubmitResult = (payload: SubmitPayload): AssessmentSubmitResult => {
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
        reviewStatus: toReviewStatus(a.review_status),
        reviewedAtISO: a.reviewed_at ?? null,
        reviewNote: a.review_note ?? null,
    };
};

export interface RawRecordAnswer {
    questionId: string;
    answerScore?: number | null;
    answerOptionId?: string | null;
    answerOptionText?: string | null;
    answerText?: string | null;
    answerNumber?: number | null;
    answerDate?: string | null;
    answerBoolean?: boolean | null;
    answerComment?: string | null;
    answerEvidenceUrls?: string[] | null;
}

export interface RawFormRecord {
    id: string;
    number: number;
    evidenceUrls?: string[] | null;
    createdAt: string;
    updatedAt: string;
    answers?: RawRecordAnswer[];
}

const mapRecordAnswer = (raw: RawRecordAnswer): AssessmentRecordAnswer => ({
    questionId: raw.questionId,
    score: toQuestionScore(raw.answerScore),
    optionId: raw.answerOptionId ?? null,
    optionText: raw.answerOptionText ?? null,
    answerText: raw.answerText ?? null,
    answerNumber: raw.answerNumber ?? null,
    answerDate: raw.answerDate ?? null,
    answerBoolean: raw.answerBoolean ?? null,
    comment: raw.answerComment ?? null,
    evidenceUrls: raw.answerEvidenceUrls ?? [],
});

export const mapFormRecord = (raw: RawFormRecord): AssessmentRecord => ({
    id: raw.id,
    number: raw.number,
    evidenceUrls: raw.evidenceUrls ?? [],
    createdAtISO: raw.createdAt,
    updatedAtISO: raw.updatedAt,
    answers: (raw.answers ?? []).map(mapRecordAnswer),
});

export interface CategoryQuestionSetPayload {
    field: RawRef;
    category: RawRef;
    progress: RawQuestionProgress;
    questionKind?: string;
    records?: RawFormRecord[];
    evidenceUrls?: string[] | null;
    questions: RawQuestionDetail[];
}

export const mapCategoryQuestionSet = (payload: CategoryQuestionSetPayload): CategoryQuestionSet => ({
    field: { id: payload.field.id, name: payload.field.name ?? '' },
    category: { id: payload.category.id, name: payload.category.name ?? '' },
    progress: {
        totalQuestions: payload.progress?.totalQuestions ?? 0,
        answered: payload.progress?.answered ?? 0,
        percentage: payload.progress?.percentage ?? 0,
    },
    questionKind: toStatedQuestionKind(payload.questionKind),
    records: (payload.records ?? []).map(mapFormRecord),
    evidenceUrls: payload.evidenceUrls ?? [],
    questions: (payload.questions ?? []).map(question =>
        mapQuestionDetail({
            field: payload.field,
            category: payload.category,
            question,
            locked: false,
        }),
    ),
});

const mapFieldHistoryCategory = (raw: RawHistoryCategory): AssessmentReviewCategory => ({
    id: raw.id,
    name: raw.name ?? '',
    totalQuestions: raw.totalQuestions ?? 0,
    answered: raw.answered ?? 0,
    percentage: toPercentage(
        raw.totalQuestions > 0 ? (raw.answered / raw.totalQuestions) * 100 : 0,
    ),
    questions: (raw.questions ?? []).map(mapReviewQuestion),
});

export const mapFieldHistory = (payload: FieldHistoryPayload): AssessmentReview => ({
    field: { id: payload.field.id, name: payload.field.name ?? '' },
    submission: {
        status: mapAssessmentStatus(payload.status),
        submittedAtISO: payload.submittedAt ?? null,
        totalQuestions: payload.score?.totalQuestions ?? 0,
        answered: payload.score?.answered ?? 0,
        percentage: toPercentage(payload.score?.percentage),
        reviewStatus: toReviewStatus(payload.reviewStatus),
        reviewNote: payload.reviewNote ?? null,
    },
    categories: (payload.categories ?? []).map(mapFieldHistoryCategory),
});

export interface RawMyAssessmentField {
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
        reviewStatus?: string | null;
    };
}
export interface MyAssessmentsPayload {
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
    reviewStatus: toReviewStatus(raw.assessment.reviewStatus),
});

export const mapMyAssessments = (payload: MyAssessmentsPayload): MyAssessmentsOverview => {
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

export interface RawHistoryItem {
    field: { id: string; name: string; crop: string | null };
    farm: { id: string; name: string };
    program?: { id: string | null; name: string | null } | null;
    assessment: {
        totalQuestions: number;
        answered: number;
        percentage: number;
        submittedAt: string | null;
        reviewStatus?: string | null;
    };
}
export interface HistoryPayload {
    count: number;
    assessments: RawHistoryItem[];
}

export const mapHistoryItem = (raw: RawHistoryItem): MyAssessmentField => ({
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
    reviewStatus: toReviewStatus(raw.assessment.reviewStatus),
});

export interface RawRegenCategory {
    id: string;
    name: string;
    score: number | null;
    answered: number;
}

export interface RawFieldRegenIndex {
    field: RawAssessmentField;
    regenHealthIndex: number | null;
    rating: string | null;
    categories: RawRegenCategory[];
    topCategory: string | null;
}

export const mapRegenIndex = (raw: RawFieldRegenIndex): FieldRegenIndex => ({
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

export interface RawComparisonQuestion {
    id: string;
    questionCode: string;
    questionText: string;
    farmerScore: number | null;
    assessorScore: number | null;
    farmerAnswered?: boolean;
    assessorAnswered?: boolean;
    difference: number | null;
}

export interface RawComparisonCategory {
    id: string;
    name: string;
    questions: RawComparisonQuestion[];
}

export interface ComparisonPayload {
    field: RawRef;
    farmer: { submitted: boolean; percentage: number };
    assessor: { submitted: boolean; percentage: number };
    categories: RawComparisonCategory[];
}

const mapComparisonQuestion = (raw: RawComparisonQuestion): ComparisonQuestion => ({
    id: raw.id,
    code: raw.questionCode ?? '',
    text: raw.questionText ?? '',
    farmerScore: toQuestionScore(raw.farmerScore),
    assessorScore: toQuestionScore(raw.assessorScore),
    farmerAnswered: raw.farmerAnswered ?? raw.farmerScore !== null,
    assessorAnswered: raw.assessorAnswered ?? raw.assessorScore !== null,
    difference: raw.difference ?? null,
});

const mapComparisonCategory = (raw: RawComparisonCategory): ComparisonCategory => ({
    id: raw.id,
    name: raw.name ?? '',
    questions: (raw.questions ?? []).map(mapComparisonQuestion),
});

export const mapComparison = (payload: ComparisonPayload): AssessorComparison => ({
    field: { id: payload.field.id, name: payload.field.name ?? '' },
    farmer: {
        submitted: !!payload.farmer?.submitted,
        percentage: toPercentage(payload.farmer?.percentage),
    },
    assessor: {
        submitted: !!payload.assessor?.submitted,
        percentage: toPercentage(payload.assessor?.percentage),
    },
    categories: (payload.categories ?? []).map(mapComparisonCategory),
});
